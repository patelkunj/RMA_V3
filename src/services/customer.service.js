import {ApiError} from "../utils/ApiError.js"
import {ApiResponse} from "../utils/ApiResponse.js"
import {asyncHandler} from "../utils/asyncHandler.js"
import moment from "moment"
import bcrypt from "bcrypt"
import {
    sendAccountActivationEmail,
} from "../services/email.service.js";
import {generateRandomString, diffTwoDateTime} from "../utils/common.js"
import {
    ensureUserCanAccessOrganization,
    getAssignedOrganizationIds,
    isSuperAdmin,
} from "../utils/accessControl.js";
import { assertStrongPassword, assertValidEmail, normalizeEmail, resolveActiveStatus } from "../utils/validation.js";
import { logger } from "../utils/logger.js";
import { exposeTokensInResponse, generateSecret, hashToken } from "../utils/tokenSecurity.js";
import { authenticateCustomer, requestCustomerPasswordReset } from "../services/customerAuth.service.js";
import { respondWithSafeError, safeServiceError } from "../utils/safeError.js";
import { paginatedData } from "../utils/pagination.js";

import prisma from "../db/prisma.js"
// import { Prisma } from "@prisma/client"
// import { dmmfToRuntimeDataModel } from "@prisma/client/runtime/library"
// import { where } from "sequelize"

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

const activationUrl = (path) => `${process.env.APP_URL || "http://localhost:3000"}${path}`;
const cookieOptions = () => ({
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: process.env.NODE_ENV === "production" ? "Strict" : "Lax",
    maxAge: 3600000,
});
const refreshCookieOptions = () => ({ ...cookieOptions(), maxAge: 7 * 24 * 60 * 60 * 1000 });
const registerCustomer = asyncHandler(async (req,res) => {
    try{
            // get data from user
            const {
                organizationId,
                companyName,
                email,
                contactPersonName,
                contactPersonEmail,
                mobile,
                returnAddress,
                //organization,
                warrantyMonths,
                warrantyType,
                doaWarrantyDays,
                doaWarrantyType,
                warrantyRemarks,
                isPickupFaulty,
                salesPerson,
            } = req.body

            // validation of data
            if([organizationId, companyName,email,contactPersonName,contactPersonEmail,returnAddress,warrantyMonths, warrantyType, doaWarrantyDays, doaWarrantyType,warrantyRemarks,salesPerson].some((field) => String(field ?? "").trim() === "")){
                return res.status(400).json(new ApiError(400, "All field are required"))
            }
            const normalizedEmail = normalizeEmail(email);
            assertValidEmail(normalizedEmail);
            assertValidEmail(contactPersonEmail);

            await ensureUserCanAccessOrganization(req.user, organizationId);

            const existingCustomer = await prisma.customer.findFirst({
                where:{
                    organizationId: Number(organizationId),
                    OR: [{ companyName }, { email: normalizedEmail }],
                }
            })


            if(existingCustomer){
                return res.status(409).json(new ApiError(409, "A customer with this company name or email already exists."))
            }

            // generate the store code/ customer code
            const org = await prisma.organization.findUnique({ where:{id:Number(organizationId) }})
            if (!org) {
                return res.status(404).json(new ApiError(404,"Organization not found"))
            }
            //const last_StoreCode = await Customer.selectFields('id').orderBy('id',"DESC").limit(1).execute();
            const last_StoreCode = await prisma.customer.findFirst({
                orderBy: {id: 'desc'},
            })
            let Store_code = last_StoreCode ? `${org.alias}${String(Number(last_StoreCode.id) + 1 ).padStart(2, '0')}` : `${org.alias}01`  ;


            // encrypt the password and generate the activation token
            const encodepassword =  await bcrypt.hash(generateRandomString(16), 10)
            const activationToken = generateRandomString(55);

            // create user object - create DB entry
            const customer = await prisma.customer.create({
                data:{
                    companyName,
                    customerCode:Store_code,
                    email: normalizedEmail,
                    password:encodepassword,
                    contactPersonName,
                    contactPersonEmail,
                    mobile,
                    returnAddress,
                    //organization_id: Number(organization.value) ,
                    organizationId: Number(organizationId),
                    warrantyMonths: Number(warrantyMonths),
                    warrantyTypes: warrantyType,
                    doaWarrantyDays: Number(doaWarrantyDays),
                    doaWarrantyTypes: doaWarrantyType,
                    warrantyRemarks,
                    isPickupFaulty:Boolean(isPickupFaulty),
                    salesPerson,
                    isActive:false,
                    isLocked:true,
                    activationToken: hashToken(activationToken),
                    activationTokenExpires: new Date(Date.now() + 24 * 60 * 60 * 1000),
                },
                select: publicCustomerSelect,
            });

            // remove add password and refresh token field from response
            //const createdcustomer = await Customer.find({id:customer},['password','activation_token']).execute();

            const log={
                actorId: req.user?.id,
                actorRole: req.user?.role,
                description : `Register a customer - ${customer.companyName}`,
            }

            // check for customer creation
            if(customer){
                // Assign Customer in to All the user with Full Assign type.
                // const customer_id = "," + customer;
                //await User.assignStore(customer_id)


                //send email for active the account.
                const emailSend = await sendAccountActivationEmail({
                    to: customer.email,
                    name: customer.contactPersonName || customer.companyName,
                    activationUrl: activationUrl(`/api/v1/customers/activate/${activationToken}`),
                });

                log.logStatus =  "Successful";
                await prisma.systemLog.create({data:log})

                if(emailSend){
                    return res.status(201).json(new ApiResponse(201, customer, " Customer register successfully and send an activation email"))
                }
                // return response
                return res.status(201).json(new ApiResponse(201, customer, " Customer register successfully and error while sending the email "))

            }else{

                log.logStatus =  "Failure";
                await prisma.systemLog.create({data:log})
                return res.status(500).json(new ApiError(500, "Unable to register customer."))
            }

    }catch(error){
        return respondWithSafeError(res, error, "customer.register", "Unable to register customer.");
    }

})

const loginCustomer = asyncHandler(async (req, res) => {
    const session = await authenticateCustomer(req.body, {
        ipAddress: req.ip || req.socket?.remoteAddress,
        userAgent: req.headers["user-agent"],
    });
    if (session.mfaRequired) {
        return res.status(202).json(new ApiResponse(202, { mfaRequired: true }, "A multi-factor authentication code is required."));
    }
    const options = cookieOptions();
    const csrfToken = generateSecret(24);
    return res
        .status(200)
        .cookie("accessToken", session.accessToken, options)
        .cookie("refreshToken", session.refreshToken, refreshCookieOptions())
        .cookie("csrfToken", csrfToken, { ...options, httpOnly: false })
        .json(new ApiResponse(200, {
            user: session.user,
            csrfToken,
            ...(exposeTokensInResponse() ? {
                accessToken: session.accessToken,
                refreshToken: session.refreshToken,
            } : {}),
        }, "Customer login successfully"));
});

const logoutCustomer = asyncHandler( async (req, res) =>{

    try{

        // Add JWT token into Database
        const customer = req.customer
        //const user = User.findByField("id='"+userid+"'")

        const log={
            actorId: customer.id,
            actorRole:customer.role,
            description : `${customer.companyName} did the logout`,
            logStatus: "Successful",
        }

        // remove cookies
        const options = {
            httpOnly : true,
            secure: true
        }

        await prisma.systemLog.create({data:log})

        const refreshToken = req.cookies?.refreshToken || req.body?.refreshToken;
        if (refreshToken) {
            await prisma.customerSession.updateMany({
                where: {
                    customerId: customer.id,
                    refreshTokenHash: hashToken(refreshToken),
                    revokedAt: null,
                },
                data: { revokedAt: new Date() },
            });
        }

        return res
        .status(200)
        .clearCookie("accessToken",options)
        .clearCookie("refreshToken",options)
        .clearCookie("csrfToken", { ...options, httpOnly: false })
        .json(
            new ApiResponse(200, null, "Customer logged out successfully.")
        )

    }catch(error){
        logger.error("Customer logout failed", error)
        return respondWithSafeError(res, error, "customer.logout", "Unable to log out.");
    }

})

const changeCurrentPassword = asyncHandler( async (req, res) =>{

    try{
        const {oldPassword, newPassword} = req.body

        if(!oldPassword || !newPassword){
            return res.status(400).json(new ApiError(400, "passwords are required"))
        }
        assertStrongPassword(newPassword);

        const customer = await prisma.customer.findUnique({
            where:{id:req.customer?.id}
        })
        const isPasswordCorrect = await bcrypt.compare(oldPassword, customer.password)

        if(!isPasswordCorrect){
            return res.status(400).json(new ApiError(400, "Invalid Password"))
        }

        const encryptNewPassword =  await bcrypt.hash(newPassword, 10)
        //const changePassword = await Customer.update({'id':customer.id}, {password: encryptNewPassword})
        const changepassword = await prisma.customer.update({
            where:{id:customer.id},
            data:{password: encryptNewPassword},
            select: publicCustomerSelect,
        })

        const log={
            actorId: customer.id,
            actorRole: "customer",
            description : `${customer.companyName} change the password`,
        }

        if(!changepassword){
            log.logStatus =  "Unsuccessful";
            await prisma.systemLog.create({data:log})
            return res.status(400).json(new ApiError(400, " Issue while updateing the passowrd."))
        }

        await prisma.customerSession.updateMany({
            where: { customerId: customer.id, revokedAt: null },
            data: { revokedAt: new Date() },
        });
        log.logStatus =  "Successful";
        await prisma.systemLog.create({data:log})

        return res
        .status(200)
        .json(new ApiResponse(200, changepassword , "Password Changed Successfully"))
    }catch(error){
        logger.error("Customer password change failed", error)
        return respondWithSafeError(res, error, "customer.change-password", "Unable to change password.");
    }
})

const activeCustomer = asyncHandler( async (req, res) =>{

    try{
        const {token} = req.params

        //const customer = await Customer.find({'activation_token':token}).execute();
        const customer =await prisma.customer.findFirst({
            where:{activationToken: hashToken(token), activationTokenExpires: { gt: new Date() }}
        })

        if(!customer){
            return res.status(400).json(new ApiError(400, " Error while activating account."))
        }

        const log={
            actorId: customer.id,
            actorRole: "customer",
            description : `${customer.companyName} account is activated. `
        }

        const data = {
            isActive:true,
            isLocked:false,
            activationToken:null,
            activationTokenExpires:null,
            failedLoginAttempts: 0,
        };

        const timeDiffernce = diffTwoDateTime(moment().format("YYYY-MM-DD HH:mm:ss"),customer.createdDate)

        if(customer){
            if(timeDiffernce.hours < 24 &&  timeDiffernce.minutes < 1440 ){
                //const updateCustomer = await Customer.update({'id':customer.id}, data)
                const updateCustomer = await prisma.customer.update({
                    where:{id:customer.id},
                    data:data,
                    select: publicCustomerSelect,
                })

                if(!updateCustomer){
                    log.logStatus =  "Unsuccessful";
                    await prisma.systemLog.create({data:log})
                    return res.status(400). json(new ApiError(400,"error while updating activated the customer account." ))
                }else{
                    log.logStatus =  "Successful";
                    await prisma.systemLog.create({data:log})
                }
                return res.status(200).json(new ApiResponse(200, updateCustomer, "customer account is activated successfully."))
            }else{
                log.logStatus =  "Unsuccessful";
                await prisma.systemLog.create({data:log})
                return res.status(400).json(new ApiError(400," Token is expired."))
            }
        }else{
            log.logStatus =  "Unsuccessful";
            await prisma.systemLog.create({data:log})
            return res.status(400).json( new ApiError(400," Token is not recognised."))
        }

    }catch(error){
        logger.error("Customer activation failed", error)
        return respondWithSafeError(res, error, "customer.activate", "Unable to activate customer.");
    }

})

const getCustomerInfo = asyncHandler( async (req, res) =>{
    try{

        const email = req.query.email ?? req.body?.email

        if(!email){
            return res.status(400).json(new ApiError(400," email is required."))
        }
        const normalizedEmail = normalizeEmail(email);
        assertValidEmail(normalizedEmail);

        //const customer = await Customer.findByField("email='"+email+"'")
        //const customer = await Customer.find({'email':email},['password','activation_token'])
        const organizationIds = isSuperAdmin(req.user)
            ? []
            : await getAssignedOrganizationIds(req.user);

        const customer = await prisma.customer.findFirst({
            where:{
                email: normalizedEmail,
                ...(isSuperAdmin(req.user) ? {} : { organizationId: { in: organizationIds } }),
            },
            select: publicCustomerSelect,
        })

        if(customer){
           return res.status(200).json(new ApiResponse(200, customer, "Customer information fetched successfully."))
        }else{
            return res.status(404).json(new ApiError(404, "Customer not found."))
        }
    }catch(error){
        logger.error("Customer info lookup failed", error)
        return respondWithSafeError(res, error, "customer.info", "Unable to fetch customer information.");
    }
})

// for forget password
const getCustomerDetail = asyncHandler(async (req, res) => {
    await requestCustomerPasswordReset(req.body);
    return res.status(200).json(new ApiResponse(200, null, "If the account exists, a reset link will be sent."));
});

const forgetPassword = asyncHandler( async (req, res) =>{
    try{

            const {token} = req.params
            const {newPassword} = req.body

            if((!token) || (!newPassword)){
                return res.status(400).json(new ApiError(400, " password is required."))
            }
            assertStrongPassword(newPassword);

            //const customer = await Customer.findByField(" activation_token ='" + token+"'")
            //const customer = await Customer.find({'activation_token':token}).execute();
            const tokenHash = hashToken(token);
            const customer = await prisma.customer.findFirst({
                where:{passwordResetToken: tokenHash},
            })

            if (!customer) {
                return res.status(400).json(new ApiError(400, "Token is not recognised"))
            }

            const log={
                actorId: customer.id,
                actorRole: "customer",
                description : `${customer.companyName} password has been changed.`,
            }

            if(customer.passwordResetToken === tokenHash && customer.passwordResetExpires && customer.passwordResetExpires > new Date()){
                const encryptNewPassword =  await bcrypt.hash(newPassword, 10)
                const changePassword = await prisma.customer.update({
                    where: {id:customer.id},
                    data: {
                        password: encryptNewPassword,
                        isLocked:false,
                        passwordResetToken: null,
                        passwordResetExpires:null,
                        failedLoginAttempts: 0,
                        lockedAt: null,
                    },
                    select: publicCustomerSelect,
                 })

                if(!changePassword){
                    log.logStatus =  "Unsuccessful";
                    await prisma.systemLog.create({data:log})
                    throw new ApiError(400, " Issue while updateing the passowrd.")
                }

                await prisma.customerSession.updateMany({
                    where: { customerId: customer.id, revokedAt: null },
                    data: { revokedAt: new Date() },
                });
                log.logStatus =  "Successful";
                await prisma.systemLog.create({data:log})

                return res
                .status(200)
                .json(new ApiResponse(200, changePassword , "Password Changed Successfully"))
            }else{
                throw new ApiError(400, "Toekn is not recognise")
            }
    }catch(error){
        logger.error('Customer forgot password failed', error)
        return respondWithSafeError(res, error, "customer.password-reset", "Unable to reset customer password.");
    }

})

const listCustomer = asyncHandler( async (req, res) =>{
    try{
        const page = Math.max(Number(req.query.page || req.body?.page) || 1, 1);
        const limit = Math.min(Math.max(Number(req.query.limit || req.body?.limit) || 50, 1), 100);
        const skip = (page - 1) * limit;

        const organizationIds = isSuperAdmin(req.user)
            ? []
            : await getAssignedOrganizationIds(req.user);

        const where = isSuperAdmin(req.user)
            ? {}
            : { organizationId: { in: organizationIds } };

        //const customer = await Customer.find({}, ['password','activation_token']).execute();
        const [customers, total] = await Promise.all([
            prisma.customer.findMany({
                where,
                skip,
                take: limit,
                select: publicCustomerSelect,
                orderBy: { companyName: "asc" },
            }),
            prisma.customer.count({ where }),
        ]);

        return res.status(200).json(new ApiResponse(
            200,
            paginatedData(customers, { total, page, limit }, "customers"),
            "Customers fetched successfully.",
        ))

    }catch(error){
        throw safeServiceError(error, "customer.list", "Unable to list customers.");
    }
})

const updateCustomer = asyncHandler( async (req, res) =>{
    try{
        const {
            companyName,
            email,
            contactPersonName,
            contactPersonEmail,
            mobile,
            returnAddress,
            warrantyMonths,
            warrantyType,
            doaWarrantyType,
            warrantyRemarks,
            salesPerson,
            isPickupFaulty
        } = req.body
        const id = req.params.id ?? req.body?.id;
        const doaWarrantyDays = req.body.doaWarrantyDays ?? req.body.doaArrantyDays;

        if([companyName,email,contactPersonName,contactPersonEmail,returnAddress,warrantyMonths, warrantyType, doaWarrantyDays,doaWarrantyType,warrantyRemarks,salesPerson].some((field) => String(field ?? "").trim() === "")){
            throw new ApiError(400, "All field are required")
        }
        const normalizedEmail = normalizeEmail(email);
        assertValidEmail(normalizedEmail);
        assertValidEmail(contactPersonEmail);

        const existingCustomer = await prisma.customer.findUnique({
            where: { id: Number(id) },
            select: { organizationId: true },
        });

        if (!existingCustomer) {
            return res.status(404).json(new ApiError(404, "Customer not found."));
        }

        await ensureUserCanAccessOrganization(req.user, existingCustomer.organizationId);

        const customer = await prisma.customer.update({
            where:{id:Number(id)},
            data:{
                companyName,
                email: normalizedEmail,
                contactPersonName,
                contactPersonEmail,
                mobile,
                returnAddress,
                warrantyMonths,
                warrantyTypes: warrantyType,
                doaWarrantyDays: Number(doaWarrantyDays),
                doaWarrantyTypes: doaWarrantyType,
                warrantyRemarks,
                salesPerson,
                isPickupFaulty
            },
            select: publicCustomerSelect,
        })

        if(!customer){
            return res.status(400).json(new ApiError(400, "Error while updating customer."))
        }

        res.status(200).json(new ApiResponse(200, customer, "Customer updated successfully."))

    }catch(error){
        throw safeServiceError(error, "customer.update", "Unable to update customer.");
    }
})

const searchCustomer = asyncHandler(async(req,res)=>{
    try {
        const searchTerm = req.query.searchTerm ?? req.query.q ?? req.body?.searchTerm

        if (!String(searchTerm ?? "").trim()) {
            throw new ApiError(400, "searchTerm is required.")
        }

        const organizationIds = isSuperAdmin(req.user)
            ? []
            : await getAssignedOrganizationIds(req.user);

        const customer = await prisma.customer.findMany({
            where: {
                ...(isSuperAdmin(req.user) ? {} : { organizationId: { in: organizationIds } }),
                OR: [
                    { companyName: { contains: searchTerm, mode: "insensitive" } },
                    { customerCode: { contains: searchTerm, mode: "insensitive" } },
                    { email: { contains: searchTerm, mode: "insensitive" } },
                    { contactPersonName: { contains: searchTerm, mode: "insensitive" } },
                ],
            },
            select: publicCustomerSelect,
            take: 50,
        })

        return res.status(200).json(new ApiResponse(200, customer, "Customers fetched successfully."))
    } catch (error) {
        throw safeServiceError(error, "customer.search", "Unable to search customers.");
    }
})

const getCustomerByID = asyncHandler( async (req, res) =>{
    try{

        const id = req.params.id ?? req.body?.id
        if(!id){
            return res.status(400).json(new ApiError(400,'customer id is requied.'))
        }

        const organizationIds = isSuperAdmin(req.user)
            ? []
            : await getAssignedOrganizationIds(req.user);

        const customer = await prisma.customer.findFirst({
            where:{
                id:Number(id),
                ...(isSuperAdmin(req.user) ? {} : { organizationId: { in: organizationIds } }),
            },
            select: publicCustomerSelect,
        })

        if(customer){
           return res.status(200).json(new ApiResponse(200, customer, "Customer information fetched successfully."))
        }else{
            return res.status(404).json(new ApiError(404, "Customer not found."))
        }
    }catch(error){
        return respondWithSafeError(res, error, "customer.detail", "Unable to fetch customer.");
    }
})

const toggleStatus = asyncHandler( async (req, res) =>{
    try {

        const id = req.params.id ?? req.query.id ?? req.body?.id

        if(!id){
            return res.status(400).json(new ApiError(400, "All the field required"));
        }

        const customerData = await prisma.customer.findUnique({
            where:{id:Number(id)},
            select: publicCustomerSelect,
        })

        if(!customerData){
            return res.status(404).json(new ApiError(404,"Customer not found."))
        }

        await ensureUserCanAccessOrganization(req.user, customerData.organizationId);
        const nextStatus = resolveActiveStatus(req.body?.isActive, {
            currentStatus: customerData.isActive,
            isDeprecatedRoute: req.isDeprecatedRoute,
        });

        const customer = await prisma.customer.update({
            where: {id:Number(id)},
            data: {isActive: nextStatus},
            select: publicCustomerSelect,
        })

        if(!customer){
            throw new ApiError(400," Error while updating customer status.")
        }

        const log={
            actorId: req.user.id,
            actorRole: req.user.role,
            description : `${req.user.firstName} ${req.user.lastName} has ${nextStatus ? 'activated' : 'deactivated'} the customer ${customerData.companyName}`,
            logStatus: "Successful"
        }
        await prisma.systemLog.create({data:log})

        return res.status(200).json(new ApiResponse(200, customer, "Customer status changed successfully."))

    } catch (error) {
        throw safeServiceError(error, "customer.update-status", "Unable to change customer status.");
    }
})

export {
    registerCustomer,
    loginCustomer,
    logoutCustomer,
    changeCurrentPassword,
    activeCustomer,
    getCustomerInfo,
    getCustomerDetail,
    forgetPassword,
    listCustomer,
    updateCustomer,
    searchCustomer,
    getCustomerByID,
    toggleStatus
}
