import {ApiError} from "../utils/ApiError.js"
import {ApiResponse} from "../utils/ApiResponse.js"
import {asyncHandler} from "../utils/asyncHandler.js"
import moment from "moment"
import bcrypt from "bcrypt"
import {generateRandomString, diffTwoDateTime} from "../utils/common.js"
import {
    buildPasswordResetUrl,
    sendAccountActivationEmail,
    sendPasswordResetEmail,
} from "../services/email.service.js";
import { generateAccessToken, generateRefreshToken } from "../utils/tokenHandler.js"
import { assertStrongPassword, assertValidEmail, normalizeEmail, resolveActiveStatus } from "../utils/validation.js";
import { logger } from "../utils/logger.js";
import { createSession } from "../services/session.service.js";
import { exposeTokensInResponse, generateSecret, hashToken } from "../utils/tokenSecurity.js";
import { verifyLoginMfa } from "../services/mfa.service.js";
import { respondWithSafeError } from "../utils/safeError.js";
import { paginatedData } from "../utils/pagination.js";

import prisma from "../db/prisma.js";
import {
    ensureUserCanAccessOrganization,
    ensureUserManagementAccess,
    getManagedUserWhere,
    isSuperAdmin,
} from "../utils/accessControl.js";

const publicUserSelect = {
    id: true,
    firstName: true,
    lastName: true,
    email: true,
    mobile: true,
    role: true,
    isActive: true,
    isLocked: true,
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
const maxFailedLoginAttempts = Number(process.env.AUTH_LOCK_MAX_FAILURES || 5);
const DUMMY_PASSWORD_HASH = "$2b$10$cVCAFiPlM1fe41WsyhSFgOzl4yT3EGAN89HAHlbJvoUXnYSZfw/IC";
const parseAssignmentIds = (value, objectKey) => {
    const entries = Array.isArray(value) ? value : String(value ?? "").split(",");
    return entries
        .map((entry) => Number(typeof entry === "object" ? entry?.[objectKey] : String(entry).trim()))
        .filter(Number.isInteger);
};

const recordFailedLogin = async (user) => {
    const updated = await prisma.user.update({
        where: { id: user.id },
        data: { failedLoginAttempts: { increment: 1 } },
        select: { failedLoginAttempts: true },
    });
    if (updated.failedLoginAttempts < maxFailedLoginAttempts) return false;
    await prisma.user.update({
        where: { id: user.id },
        data: { isLocked: true, lockedAt: new Date() },
    });
    return true;
};

const clearFailedLogin = (user) => prisma.user.update({
    where: { id: user.id },
    data: { failedLoginAttempts: 0, lastLoginAt: new Date() },
});

const registerUser = asyncHandler(async (req,res) => {
    try{
            const {
                firstName,
                lastName,
                email,
                mobile,
                role,
            } = req.body
            const assignedCustomerInput = req.body.assignedCustomerIds ?? req.body.assignedCustomerId;
            const assignedOrganizationInput = req.body.assignedOrganizationIds ?? req.body.assignedOrgId;


            // validation of data
            if([firstName,lastName,email,mobile,role].some((field) => String(field ?? "").trim() === "")){
                throw new ApiError(400, "All field are required")
            }
            const normalizedEmail = normalizeEmail(email);
            assertValidEmail(normalizedEmail);

            const existingUser = await prisma.user.count({
                where:{email: normalizedEmail}
            });

            if(existingUser){
                throw new ApiError(409, "A user with this email address already exists.")
            }

            const password = generateRandomString(12);
            const encodepassword =  await bcrypt.hash(password, 10)
            const activationToken = generateRandomString(55);

            const normalizedRole = String(role).trim().toUpperCase();
            if (!["SUPER_ADMIN", "ADMIN", "TECHNICIAN"].includes(normalizedRole)) throw new ApiError(400, "Invalid user role.");
            if (normalizedRole === "SUPER_ADMIN" && req.user.role !== "SUPER_ADMIN") throw new ApiError(403, "Only super administrators can create super administrators.");
            const orgIds = parseAssignmentIds(assignedOrganizationInput, "organizationId");
            const customerIds = parseAssignmentIds(assignedCustomerInput, "customerId");

            if (orgIds.length === 0 || customerIds.length === 0) {
                throw new ApiError(400, "At least one valid organization and customer assignment is required")
            }
            await Promise.all(orgIds.map((organizationId) => ensureUserCanAccessOrganization(req.user, organizationId)));
            const validCustomerCount = await prisma.customer.count({ where: { id: { in: customerIds }, organizationId: { in: orgIds } } });
            if (validCustomerCount !== new Set(customerIds).size) throw new ApiError(400, "Every assigned customer must belong to an assigned organization.");

            const user = await prisma.$transaction(async (tx) => {
                const createdUser = await tx.user.create({
                    data:{
                        firstName,
                        lastName,
                        email: normalizedEmail,
                        password:encodepassword,
                        mobile,
                        role: normalizedRole,
                        isActive:false,
                        isLocked:true,
                        activationToken: hashToken(activationToken),
                        activationTokenExpires: new Date(Date.now() + 24 * 60 * 60 * 1000),
                    },
                    select: publicUserSelect,
                })

                await tx.userOrganization.createMany({
                    data: orgIds.map(organizationId => ({
                        userId: createdUser.id,
                        organizationId,
                    })),
                    skipDuplicates: true,
                })

                await tx.userCustomer.createMany({
                    data: customerIds.map(customerId => ({
                        userId: createdUser.id,
                        customerId,
                    })),
                    skipDuplicates: true,
                })

                return createdUser;
            })

            const log={
                actorId: user.id,
                actorRole: user.role,
                description : `${user.firstName + ' '+ user.lastName} is registered. `,
            }

            // check for user creation
            if(user){
                //send email for active the account.
                const emailSend = await sendAccountActivationEmail({
                    to: user.email,
                    name: `${user.firstName} ${user.lastName}`,
                    activationUrl: activationUrl(`/api/v1/users/activate/${activationToken}`),
                });

                log.logStatus =  "Successful";
                await prisma.systemLog.create({data:log})

                if(emailSend){
                    return res.status(201).json(new ApiResponse(201, user, " User register successfully and send an activation email"))
                }
                // return response
                return res.status(201).json(new ApiResponse(201, user, " User register successfully and error while sending the email "))

            }else{

                log.logStatus =  "Failure";
                await prisma.systemLog.create({data:log})
                return res.status(500).json(new ApiError(500, "Something went wrong while adding user"))
            }


    }catch(error){
        return respondWithSafeError(res, error, "user.register", "Unable to register user.");
    }
})


const loginUser = asyncHandler( async (req,res)=>{

    try {
        // get data from user
        const {email, password} = req.body;

        // validate data
        if(!email || !password){
            return res.status(400).json(new ApiError(400, "Email and password are required."))
        }

        // check user in db
        const normalizedEmail = normalizeEmail(email);
        assertValidEmail(normalizedEmail);

        const user = await prisma.user.findUnique({where:{email: normalizedEmail}});

        const isPasswordValid = await bcrypt.compare(password, user?.password || DUMMY_PASSWORD_HASH)
        if(!user || !isPasswordValid){
            if (user) {
                await prisma.systemLog.create({ data: { actorId: user.id, actorRole: user.role, description: "Failed login attempt.", logStatus: "Failure" } });
                await recordFailedLogin(user);
            }
            return res.status(401).json(new ApiError(401, "Invalid email or password."))
        }

        if(!user.isActive) return res.status(403).json(new ApiError(403, "Account is not active."));
        if(user.isLocked) return res.status(423).json(new ApiError(423, "Account is locked."));

        const log={ actorId: user.id, actorRole:user.role, description : `${user.firstName} ${user.lastName} logged in.` }

        const mfa = await verifyLoginMfa(user, req.body.mfaCode);
        if (mfa.required) {
            return res.status(202).json(new ApiResponse(202, { mfaRequired: true }, "A multi-factor authentication code is required."));
        }

        await clearFailedLogin(user);

        // generae Accesstoken & refToken
        const accessToken= await generateAccessToken(user)
        const refreshToken= await generateRefreshToken(user)
        //const {accessToken, refreshToken} = await generateAccessAndRefereshToken(user)

        // send cookies
        //const loggedInUser= await User.findById(user.id)
        const loggedInUser= await prisma.user.findUnique({
            where:{id:user.id},
            select: publicUserSelect,
        })

        if(!loggedInUser){
            throw new ApiError(404, "User not found.")
        }

        await createSession({
            actor: loggedInUser,
            refreshToken,
            ipAddress: req.ip || req.socket?.remoteAddress,
            userAgent: req.headers["user-agent"],
        });

        // insert data into log table
        log.logStatus =  "Successful";
        await prisma.systemLog.create({data:log})

        const options = cookieOptions()
        const csrfToken = generateSecret(24);

        // send response
        return res
        .status(200)
        .cookie("accessToken",accessToken,options)
        .cookie("refreshToken",refreshToken,refreshCookieOptions())
        .cookie("csrfToken", csrfToken, { ...options, httpOnly: false })
        .json(
            new ApiResponse(
                200,
                {
                    user: loggedInUser,
                    csrfToken,
                    ...(exposeTokensInResponse() ? { accessToken, refreshToken } : {})
                },
                "User logged in Successfully"
            )
        )
    } catch (error) {
        logger.error("User login failed", error)
        return respondWithSafeError(res, error, "user.login", "Unable to log in.");
    }
})


const logoutUser = asyncHandler(async(req,res)=>{
    try {

        // Add JWT token into Database
        const user = req.user
        //const user = User.findByField("id='"+userid+"'")

        const log={
            actorId: user.id,
            actorRole:user.role,
            description : `${user.firstName} ${user.lastName} did the logout`,
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
            await prisma.sessionManagement.updateMany({
                where: {
                    userId: user.id,
                    revokedAt: null,
                    OR: [{ refreshTokenHash: hashToken(refreshToken) }, { refreshToken }],
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
            new ApiResponse(200, null, "User logged out successfully.")
        )

    } catch (error) {
        logger.error("User logout failed", error)
        return respondWithSafeError(res, error, "user.logout", "Unable to log out.");
    }
})

const changeCurrentPassword = asyncHandler(async(req, res) =>{
    try {

        const {oldPassword, newPassword} = req.body

        //const user = await User.findById(req.user?.id)
        if (!oldPassword || !newPassword) {
            return res.status(400).json(new ApiError(400, "Old password and new password are required."))
        }

        assertStrongPassword(newPassword);

        const user = await prisma.user.findUnique({
            where: { id: req.user?.id },
        })

        if (!user) {
            return res.status(404).json(new ApiError(404, "User not found."))
        }

        const isPasswordCorrect = await bcrypt.compare(oldPassword, user.password)

        if(!isPasswordCorrect){
            return res.status(400).json(new ApiError(400, "Invalid old Password."))
        }

        const encryptNewPassword =  await bcrypt.hash(newPassword, 10)
        const changePassword = await prisma.user.update({
                where: {id:user.id},
                data: {password: encryptNewPassword},
                omit:{
                    password:true,
                    activationToken:true,
                    passwordResetToken:true,
                    passwordResetExpires:true
                }
        })


        const log={
            actorId: user.id,
            actorRole: user.role,
            description : `${user.firstName} ${user.lastName} change the password`,
        }

        if(!changePassword){
            log.logStatus =  "Unsuccessful";
            await prisma.systemLog.create({data:log})
            return res.status(400).json(new ApiError(400, " Issue while updateing the passowrd."))
        }

        await prisma.sessionManagement.updateMany({
            where: { userId: user.id, revokedAt: null },
            data: { revokedAt: new Date() },
        });
        log.logStatus =  "Successful";
        await prisma.systemLog.create({data:log})

        return res
        .status(200)
        .json(new ApiResponse(200, changePassword , "Password Changed Successfully"))

    } catch (error) {
        logger.error("User password change failed", error)
        return respondWithSafeError(res, error, "user.change-password", "Unable to change password.");
    }
})

const activeUser = asyncHandler(async(req, res)=>{
    try {
        const {token} = req.params

        //const user = await User.findByField("activation_token ='" + activation_token +"'")
        //const user = await User.find({'activation_token':token}).execute()
        const user = await prisma.user.findFirst({
            where:{activationToken: hashToken(token), activationTokenExpires: { gt: new Date() }}
        })

        if(!user){
            return res.status(400).json(new ApiError(400,"Token is not recognised."))
        }

        const log={
            actorId: user.id,
            actorRole: user.role,
            description : `${user.firstName} ${user.lastName} is activated`,
        }

        const data = {
            isActive:true,
            isLocked:false,
            activationToken:null,
            activationTokenExpires:null,
            failedLoginAttempts: 0,
        };

        const timeDiffernce = diffTwoDateTime(moment().format("YYYY-MM-DD HH:mm:ss"),user.createdDate)

        let updateUser = null;
        if(user ){
            if(timeDiffernce.hours < 24 &&  timeDiffernce.minutes < 1440 ){
                updateUser = await prisma.user.update({
                    where:{id:user.id},
                    data : data,
                    select: publicUserSelect,
                })

                if(!updateUser){
                    log.logStatus =  "Unsuccessful";
                    await prisma.systemLog.create({data:log})
                    throw new ApiError(400,"error while updating activated the user account.")
                }else{
                    log.logStatus =  "Successful";
                    await prisma.systemLog.create({data:log})
                    return res.status(200).json(new ApiResponse(200, updateUser, "user account is activated successfully."))
                }
            }else{
                log.logStatus =  "Unsuccessful";
                await prisma.systemLog.create({data:log})
                throw new ApiError(400," Token is expired.")
            }
        }else{
            log.logStatus =  "Unsuccessful";
            await prisma.systemLog.create({data:log})
            throw new ApiError(400," Token is not recognised.")
        }

    } catch (error) {
        logger.error("User activation failed", error)
        return respondWithSafeError(res, error, "user.activate", "Unable to activate user.");
    }
})


const getUserDetail = asyncHandler( async (req, res) =>{
    try{

        const {email} = req.body
        const normalizedEmail = normalizeEmail(email);
        assertValidEmail(normalizedEmail);
        //const user = await User.findByField("email='"+email+"'")
        //const user = await User.find({'email':email}).execute();
        const user = await prisma.user.findUnique({
            where:{email:normalizedEmail},
            omit:{
                password:true,
                activationToken:true,
                passwordResetToken:true,
                passwordResetExpires:true
            }
        })


        if(user){
            const passwordResetToken = generateRandomString(55);

            // const updateUser = await User.update({'id':user.id}, data)
            const updateUser = await prisma.user.update({
                where:{id:user.id},
                data:{
                    passwordResetToken: hashToken(passwordResetToken),
                    passwordResetExpires: new Date(Date.now() + 30 * 60 * 1000),
                },
                select: publicUserSelect,
            })

            const log={
                actorId: user.id,
                actorRole: user.role,
                description : `${user.firstName} ${user.lastName} requested a password reset`,
            }

            if(updateUser){
                const emailSend = await sendPasswordResetEmail({
                    to: updateUser.email,
                    name: `${updateUser.firstName} ${updateUser.lastName}`,
                    resetUrl: buildPasswordResetUrl({
                        token: passwordResetToken,
                        accountType: "user",
                    }),
                });

                if(emailSend){
                    log.logStatus =  "Successful";
                    await prisma.systemLog.create({data:log})

                    return res.status(200).json(new ApiResponse(200, null, "If the email exists, a reset link will be sent."))
                }

                log.logStatus =  "Unsuccessful";
                await prisma.systemLog.create({data:log})

                return res.status(400).json(new ApiError(400," Error while sending the email."))
            }else{
                return res.status(400).json(new ApiError(400," Error while storeing token."))
            }
        }

        return res.status(200).json(new ApiResponse(200, null, "If the email exists, a reset link will be sent."))

    }catch(error){
        logger.error("User password reset request failed", error)
        return respondWithSafeError(res, error, "user.password-reset-request", "Unable to process password reset request.");
    }
})

const forgetPassword = asyncHandler( async (req, res) =>{
    try{

        const {token} = req.params
        const {newPassword} = req.body
        assertStrongPassword(newPassword);

        //const user = await User.findByField("email='"+email+"'")
        //const user = await User.find({'activation_token':token}).execute()
        const tokenHash = hashToken(token);
        const user = await prisma.user.findFirst({
            where:{passwordResetToken: tokenHash}
        })

        if (!user) {
            return res.status(400).json(new ApiError(400, "Token is not active."))
        }

        const log={
            actorId: user.id,
            actorRole: user.role,
            description : `${user.firstName} ${user.lastName} reset the password`,
        }

        if(user.passwordResetToken === tokenHash && user.passwordResetExpires && user.passwordResetExpires > new Date()){
            const encryptNewPassword =  await bcrypt.hash(newPassword, 10)
            //const changePassword = await User.update({'id':user.id}, {password: encryptNewPassword, activation_token: null })
            const changePassword = await prisma.user.update({
                where:{id:user.id},
                data:{
                    isLocked:false,
                    password:encryptNewPassword,
                    passwordResetToken:null,
                    passwordResetExpires:null,
                    failedLoginAttempts: 0,
                    lockedAt: null,
                },
                select: publicUserSelect,
            })

            if(!changePassword){
                log.logStatus =  "Unsuccessful";
                await prisma.systemLog.create({data:log})
                throw new ApiError(400, " Issue while updateing the passowrd.")
            }

            await prisma.sessionManagement.updateMany({
                where: { userId: user.id, revokedAt: null },
                data: { revokedAt: new Date() },
            });
            log.logStatus =  "Successful";
            await prisma.systemLog.create({data:log})

            return res
            .status(200)
            .json(new ApiResponse(200, changePassword , "Password Changed Successfully"))
        }else{
            return res.status(400).json(new ApiError(400, "Token is not active."))
        }

    }catch(error){
        logger.error('User forgot password failed', error)
        return respondWithSafeError(res, error, "user.password-reset", "Unable to reset password.");
    }

})

// add pagination
const listUser = asyncHandler( async (req, res) =>{
    try{

        const page = Math.max(Number(req.query.page || req.body?.page) || 1, 1);
        const limit = Math.min(Math.max(Number(req.query.limit || req.body?.limit) || 25, 1), 100);
        const where = await getManagedUserWhere(req.user);
        const [users, total] = await Promise.all([prisma.user.findMany({
            where,
            select: publicUserSelect,
            skip: (page - 1) * limit,
            take: limit,
            orderBy: { id: "desc" },
        }), prisma.user.count({ where })]);

        res.status(200).json(new ApiResponse(200, paginatedData(users, { total, page, limit }, "users"), "Users fetched successfully."))

    }catch(error){
        return respondWithSafeError(res, error, "user.list", "Unable to list users.");
    }
})


const getUserById = asyncHandler( async (req, res) =>{
    try{
        const id = req.params.id || req.body?.id
        if(!id)throw new ApiError(400, " Id is empty")

        //const user = await User.find({'id':id},['password','activation_token']).execute();
        await ensureUserManagementAccess(req.user, id);
        const user = await prisma.user.findFirst({
            where:{id:Number(id), ...(await getManagedUserWhere(req.user))},
            select: publicUserSelect,
        })

        if(!user){
            return res.status(404).json(new ApiError(404, "User not found."))
        }

        return res.status(200).json(new ApiResponse(200, user, " User found"))

    }catch(error){
        return respondWithSafeError(res, error, "user.detail", "Unable to fetch user.");
    }
})

const updateUser = asyncHandler( async (req, res) =>{
    try{

        const id = req.params.id || req.body?.id;
        const firstName = req.body.firstName ?? req.body.first_name;
        const lastName = req.body.lastName ?? req.body.last_name;
        const assignedCustomers = req.body.assignedCustomerIds ?? req.body.assignedCustomers ?? req.body.assignedCustomer;
        const assignedOrganizations = req.body.assignedOrganizationIds ?? req.body.assignedOrganizations ?? req.body.assignedOrg;
        const isActive = req.body.isActive ?? req.body.is_active;
        const { email, mobile, role } = req.body;

        if (!id || [firstName, lastName, email, mobile, role].some((field) => String(field ?? "").trim() === "")) {
            return res.status(400).json(new ApiError(400,"All field are required" ))
        }
        const normalizedEmail = normalizeEmail(email);
        assertValidEmail(normalizedEmail);
        const target = await ensureUserManagementAccess(req.user, id);
        const normalizedRole = String(role).trim().toUpperCase();
        if (normalizedRole === "SUPER_ADMIN" && !isSuperAdmin(req.user)) throw new ApiError(403, "Only super administrators can grant the super administrator role.");
        if (target.id === req.user.id && isActive === false) throw new ApiError(409, "You cannot deactivate your own account.");

        const orgIds = parseAssignmentIds(assignedOrganizations, "organizationId");
        const customerIds = parseAssignmentIds(assignedCustomers, "customerId");
        await Promise.all(orgIds.map((organizationId) => ensureUserCanAccessOrganization(req.user, organizationId)));
        const validCustomerCount = await prisma.customer.count({ where: { id: { in: customerIds }, organizationId: { in: orgIds } } });
        if (validCustomerCount !== new Set(customerIds).size) throw new ApiError(400, "Every assigned customer must belong to an assigned organization.");

        const user = await prisma.$transaction(async (tx) => {
            const updated = await tx.user.update({
            where:{id:Number(id)},
            data:{
                firstName,
                lastName,
                email:normalizedEmail,
                mobile:mobile,
                role:normalizedRole,
                isActive
            },
            select: publicUserSelect,
            });
            await tx.userCustomer.deleteMany({ where: { userId: Number(id) } });
            await tx.userOrganization.deleteMany({ where: { userId: Number(id) } });
            if (customerIds.length) await tx.userCustomer.createMany({ data: [...new Set(customerIds)].map((customerId) => ({ userId: Number(id), customerId })) });
            if (orgIds.length) await tx.userOrganization.createMany({ data: [...new Set(orgIds)].map((organizationId) => ({ userId: Number(id), organizationId })) });
            return updated;
        })

        const log={
            actorId: req.user?.id,
            actorRole: req.user?.role,
            description : `${req.user?.firstName} ${req.user?.lastName} update the detail of user_id ${id}`,
        }

        if(!user){
            log.logStatus =  "Unsuccessful";
            await prisma.systemLog.create({data:log})
            return res.status(400).json(new ApiError(400," Error while updating user"))
        }

        log.logStatus = "Successful";
        await prisma.systemLog.create({data:log})

        return res.status(200).json(new ApiResponse(200, user, " User updated successfully"))

    }catch(error){
        return respondWithSafeError(res, error, "user.update", "Unable to update user.");
    }
})

const toggleStatus = asyncHandler( async (req, res) =>{
    try {

        const id = req.params.id || req.query.id || req.body?.id

        if(!id){
            return res.status(400).json(new ApiError(400, "All the field required"));
        }

        await ensureUserManagementAccess(req.user, id);
        const userData = await prisma.user.findUnique({where:{id:Number(id)}})

        if(!userData){
            return res.status(404).json(new ApiError(404, "User not found"));
        }
        if (userData.id === req.user.id) throw new ApiError(409, "You cannot change your own account status.");
        const nextStatus = resolveActiveStatus(req.body?.isActive, {
            currentStatus: userData.isActive,
            isDeprecatedRoute: req.isDeprecatedRoute,
        });

        const user = await prisma.user.update({
            where:{id:Number(id)},
            data:{isActive: nextStatus},
            select: publicUserSelect,
        })

        const log={
            actorId: req.user.id,
            actorRole: req.user.role,
            description : `${req.user.firstName} ${req.user.lastName} has ${nextStatus ? 'activated' : 'deactivated'} the user ${userData.firstName} ${userData.lastName}`,
            logStatus: "Successful"
        }
        await prisma.systemLog.create({data:log})


        return res.status(200).json(new ApiResponse(200,user,"User status changed successfully"))

    } catch (error) {
        return respondWithSafeError(res, error, "user.toggle-status", "Unable to change user status.");
    }
})

// const searchUser = asyncHandler(async(req,res)=>{
//     try {
//         const {searchTerm} = req.body
//         if(!searchTerm){
//             throw new ApiError(400,"search field is empty.")
//         }
//         const users = await User.search(searchTerm)
//         if(!users){
//             throw new ApiError(400," No user found")
//         }
//         res.status(200).json(new ApiResponse(200,users, " user list."))


//     } catch (error) {
//         throw new ApiError(400," Error While searching user.")
//     }
// })

export { registerUser,
         loginUser,
         logoutUser,
         changeCurrentPassword,
         activeUser,
         getUserDetail,
         forgetPassword,
         listUser,
         getUserById,
         updateUser,
         toggleStatus,
         //searchUser
        }
