import { ApiError } from "../utils/ApiError.js";
import { decryptMfaSecret, encryptMfaSecret } from "../utils/encryption.js";
import { createTotpSecret, verifyTotp } from "../utils/totp.js";
import { generateSecret, hashToken } from "../utils/tokenSecurity.js";
import prisma from "../db/prisma.js";

const actorModel = (actor) => actor.role === "CUSTOMER" ? prisma.customer : prisma.user;

const setupMfa = async (actor) => {
    const secret = createTotpSecret();
    await actorModel(actor).update({
        where: { id: actor.id },
        data: { mfaSecretCiphertext: encryptMfaSecret(secret), mfaEnabled: false, mfaRecoveryCodeHashes: [] },
    });
    const label = encodeURIComponent(`RMA:${actor.email}`);
    const issuer = encodeURIComponent(process.env.MFA_ISSUER || "RMA Service");
    return { secret, otpauthUrl: `otpauth://totp/${label}?secret=${secret}&issuer=${issuer}&algorithm=SHA1&digits=6&period=30` };
};

const enableMfa = async (actor, code) => {
    const record = await actorModel(actor).findUnique({ where: { id: actor.id } });
    if (!record?.mfaSecretCiphertext) throw new ApiError(409, "MFA setup must be started first.");
    if (!verifyTotp(decryptMfaSecret(record.mfaSecretCiphertext), code)) throw new ApiError(400, "MFA code is invalid.");
    const recoveryCodes = Array.from({ length: 10 }, () => generateSecret(8).toUpperCase());
    await actorModel(actor).update({
        where: { id: actor.id },
        data: { mfaEnabled: true, mfaRecoveryCodeHashes: recoveryCodes.map(hashToken) },
    });
    return { enabled: true, recoveryCodes };
};

const verifyLoginMfa = async (actor, code) => {
    if (!actor.mfaEnabled) return { verified: true };
    if (!code) return { verified: false, required: true };
    if (actor.mfaSecretCiphertext && verifyTotp(decryptMfaSecret(actor.mfaSecretCiphertext), code)) return { verified: true };
    const recoveryHash = hashToken(String(code).trim().toUpperCase());
    if (actor.mfaRecoveryCodeHashes.includes(recoveryHash)) {
        const consumed = actor.role === "CUSTOMER"
            ? await prisma.$executeRaw`
                UPDATE "Customer"
                SET "mfaRecoveryCodeHashes" = array_remove("mfaRecoveryCodeHashes", ${recoveryHash}),
                    "updatedDate" = NOW()
                WHERE "id" = ${Number(actor.id)}
                  AND "mfaEnabled" = true
                  AND ${recoveryHash} = ANY("mfaRecoveryCodeHashes")
            `
            : await prisma.$executeRaw`
                UPDATE "User"
                SET "mfaRecoveryCodeHashes" = array_remove("mfaRecoveryCodeHashes", ${recoveryHash}),
                    "updatedDate" = NOW()
                WHERE "id" = ${Number(actor.id)}
                  AND "mfaEnabled" = true
                  AND ${recoveryHash} = ANY("mfaRecoveryCodeHashes")
            `;
        if (consumed) return { verified: true, recoveryCodeUsed: true };
    }
    throw new ApiError(401, "MFA code is invalid.");
};

const disableMfa = async (actor, code) => {
    const record = await actorModel(actor).findUnique({ where: { id: actor.id } });
    await verifyLoginMfa(record, code);
    await actorModel(actor).update({
        where: { id: actor.id },
        data: { mfaEnabled: false, mfaSecretCiphertext: null, mfaRecoveryCodeHashes: [] },
    });
    return { enabled: false };
};

export { disableMfa, enableMfa, setupMfa, verifyLoginMfa };
