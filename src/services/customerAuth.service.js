import bcrypt from "bcrypt";
import prisma from "../db/prisma.js";
import { ApiError } from "../utils/ApiError.js";
import { assertValidEmail, normalizeEmail, parsePositiveInt } from "../utils/validation.js";
import { generateAccessToken, generateRefreshToken } from "../utils/tokenHandler.js";
import { createSession } from "./session.service.js";
import { verifyLoginMfa } from "./mfa.service.js";
import { buildPasswordResetUrl, sendPasswordResetEmail } from "./email.service.js";
import { generateSecret, hashToken } from "../utils/tokenSecurity.js";
import { logger } from "../utils/logger.js";

const DUMMY_PASSWORD_HASH = "$2b$10$cVCAFiPlM1fe41WsyhSFgOzl4yT3EGAN89HAHlbJvoUXnYSZfw/IC";

const publicCustomerSelect = {
    id: true,
    organizationId: true,
    companyName: true,
    customerCode: true,
    email: true,
    contactPersonName: true,
    contactPersonEmail: true,
    mobile: true,
    role: true,
    returnAddress: true,
    warrantyMonths: true,
    warrantyTypes: true,
    doaWarrantyDays: true,
    doaWarrantyTypes: true,
    warrantyRemarks: true,
    isPickupFaulty: true,
    salesPerson: true,
    isActive: true,
    isLocked: true,
    creditLimit: true,
    paymentTerms: true,
    lastLoginAt: true,
    createdDate: true,
    updatedDate: true,
};

const customerAuthenticationSelect = {
    ...publicCustomerSelect,
    password: true,
    failedLoginAttempts: true,
    mfaEnabled: true,
    mfaSecretCiphertext: true,
    mfaRecoveryCodeHashes: true,
};

const parseTenantCredentials = (payload = {}, { requirePassword = false } = {}) => {
    const organizationId = parsePositiveInt(payload.organizationId, "organizationId");
    const email = normalizeEmail(payload.email);
    assertValidEmail(email);
    const password = String(payload.password || "");
    if (requirePassword && !password) throw new ApiError(400, "Email, password, and organizationId are required.");
    return { organizationId, email, password };
};

const recordFailedCustomerLogin = async (customer) => {
    const maxAttempts = Number(process.env.AUTH_LOCK_MAX_FAILURES || 5);
    await prisma.$transaction(async (tx) => {
        await tx.$queryRaw`SELECT "id" FROM "Customer" WHERE "id" = ${customer.id} FOR UPDATE`;
        const current = await tx.customer.findUnique({
            where: { id: customer.id },
            select: { failedLoginAttempts: true },
        });
        const nextAttempts = (current?.failedLoginAttempts || 0) + 1;
        await tx.customer.update({
            where: { id: customer.id },
            data: {
                failedLoginAttempts: nextAttempts,
                ...(nextAttempts >= maxAttempts ? { isLocked: true, lockedAt: new Date() } : {}),
            },
        });
        await tx.systemLog.create({
            data: {
                actorId: customer.id,
                actorRole: "CUSTOMER",
                description: "Failed login attempt.",
                logStatus: "Failure",
            },
        });
    });
};

const authenticateCustomer = async (payload, context = {}) => {
    const { organizationId, email, password } = parseTenantCredentials(payload, { requirePassword: true });
    const customer = await prisma.customer.findUnique({
        where: { organizationId_email: { organizationId, email } },
        select: customerAuthenticationSelect,
    });

    const passwordIsValid = await bcrypt.compare(password, customer?.password || DUMMY_PASSWORD_HASH);
    if (!customer || !passwordIsValid) {
        if (customer) await recordFailedCustomerLogin(customer);
        throw new ApiError(401, "Invalid organization, email, or password.");
    }
    if (!customer.isActive) throw new ApiError(403, "Account is not active.");
    if (customer.isLocked) throw new ApiError(423, "Account is locked.");

    const mfa = await verifyLoginMfa(customer, payload.mfaCode);
    if (mfa.required) return { mfaRequired: true };

    const [accessToken, refreshToken] = await Promise.all([
        generateAccessToken(customer),
        generateRefreshToken(customer),
    ]);
    const loggedInCustomer = await prisma.$transaction(async (tx) => {
        const record = await tx.customer.update({
            where: { id: customer.id },
            data: { failedLoginAttempts: 0, lastLoginAt: new Date() },
            select: publicCustomerSelect,
        });
        await tx.systemLog.create({
            data: {
                actorId: customer.id,
                actorRole: "CUSTOMER",
                description: `${customer.companyName} logged in.`,
                logStatus: "Successful",
            },
        });
        await createSession({
            actor: record,
            refreshToken,
            ipAddress: context.ipAddress,
            userAgent: context.userAgent,
            db: tx,
        });
        return record;
    });
    return { user: loggedInCustomer, accessToken, refreshToken, mfaRequired: false };
};

const requestCustomerPasswordReset = async (payload, { sendEmail = sendPasswordResetEmail } = {}) => {
    const { organizationId, email } = parseTenantCredentials(payload);
    const customer = await prisma.customer.findUnique({
        where: { organizationId_email: { organizationId, email } },
        select: {
            id: true,
            organizationId: true,
            companyName: true,
            contactPersonName: true,
            email: true,
        },
    });
    if (!customer) return { accepted: true };

    const passwordResetToken = generateSecret(32);
    await prisma.customer.update({
        where: { id: customer.id },
        data: {
            passwordResetToken: hashToken(passwordResetToken),
            passwordResetExpires: new Date(Date.now() + 30 * 60 * 1000),
        },
    });
    const sent = await sendEmail({
        to: customer.email,
        name: customer.contactPersonName || customer.companyName,
        resetUrl: buildPasswordResetUrl({ token: passwordResetToken, accountType: "customer" }),
    });
    if (!sent) {
        logger.error("customer_password_reset_email_failed", {
            customerId: customer.id,
            organizationId: customer.organizationId,
        });
    }
    return { accepted: true };
};

export {
    authenticateCustomer,
    parseTenantCredentials,
    requestCustomerPasswordReset,
};
