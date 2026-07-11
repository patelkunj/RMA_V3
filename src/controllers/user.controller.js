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
import { assertStrongPassword, assertValidEmail, normalizeEmail } from "../utils/validation.js";
import { logger } from "../utils/logger.js";

import prisma from "../db/prisma.js";

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
const failedLoginAttempts = new Map();
const maxFailedLoginAttempts = Number(process.env.AUTH_LOCK_MAX_FAILURES || 5);

const recordFailedLogin = async (user) => {
    const key = `user:${user.id}`;
    const attempts = (failedLoginAttempts.get(key) || 0) + 1;
    failedLoginAttempts.set(key, attempts);

    if (attempts >= maxFailedLoginAttempts) {
        failedLoginAttempts.delete(key);
        await prisma.user.update({
            where: { id: user.id },
            data: { isLocked: true },
        });
        return true;
    }

    return false;
};

const clearFailedLogin = (user) => {
    failedLoginAttempts.delete(`user:${user.id}`);
};

const registerUser = asyncHandler(async (req,res) => {
    try{
            const {
                firstName,
                lastName,
                email, 
                mobile,
                role,
                assignedCustomerId,
                assignedOrgId,
            } = req.body


            // validation of data
            if([firstName,lastName,email,mobile,role,assignedCustomerId,assignedOrgId].some((field) => String(field ?? "").trim() === "")){
                throw new ApiError(400, "All field are required")
            }
            const normalizedEmail = normalizeEmail(email);
            assertValidEmail(normalizedEmail);

            const existingUser = await prisma.user.count({
                where:{email: normalizedEmail}
            });

            if(existingUser){
                throw new ApiError(400,"User with email address is already exists !!!")
            }

            const password = generateRandomString(12);
            const encodepassword =  await bcrypt.hash(password, 10)
            const activationToken = generateRandomString(55);

            const orgIds = assignedOrgId.split(",").map(id => Number(id.trim())).filter(Number.isInteger);
            const customerIds = assignedCustomerId.split(",").map(id => Number(id.trim())).filter(Number.isInteger);

            if (orgIds.length === 0 || customerIds.length === 0) {
                throw new ApiError(400, "At least one valid organization and customer assignment is required")
            }

            const user = await prisma.$transaction(async (tx) => {
                const createdUser = await tx.user.create({
                    data:{
                        firstName,
                        lastName,
                        email: normalizedEmail,
                        password:encodepassword,
                        mobile,
                        role,
                        isActive:false,
                        isLocked:true,
                        activationToken,
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
                    activationUrl: activationUrl(`/api/v1/users/activeuser/${activationToken}`),
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
        return res.status(400).json(new ApiError(400, `something went wrong in register the user ${error?.message}`))
    }
})


//TODO: Add Lock account functionality.
const loginUser = asyncHandler( async (req,res)=>{

    try {
        // get data from user
        const {email, password} = req.body;

        // validate data 
        if(!email || !password){
            //throw new ApiError(400, " email and password are required")
            return res.status(400).json(new ApiResponse(400,null, " Email and Password are required"))
        }

        // check user in db
        const normalizedEmail = normalizeEmail(email);
        assertValidEmail(normalizedEmail);

        const user = await prisma.user.findUnique({where:{email: normalizedEmail}});

        if(!user){
            //throw new ApiError(400,"User not found")
            return res.status(400).json(new ApiResponse(400,null, "User not found."))
        }

        // check the active account 
        if(user.isActive == false){
            return res.status(400).json(new ApiResponse(400,null, "User is not active. Please active the account or contact admin team."))   
        }

        if(user.isLocked){
            return res.status(423).json(new ApiResponse(423,null, "User account is locked. Please reset your password or contact admin team."))
        }

        const log={
            actorId: user.id,
            actorRole:user.role,
            description : `${user.firstName + " " + user.lastName} is login. `
        }

        // password check
        //const isPasswordValid = await User.isPasswordCorrect(password,user.password)
        const isPasswordValid = await bcrypt.compare(password,user.password)


        if(!isPasswordValid){
            log.logStatus =  "Faliure";
            await prisma.systemLog.create({data:log})
            const locked = await recordFailedLogin(user);
            if (locked) {
                return res.status(423).json(new ApiResponse(423, null, "Too many failed login attempts. User account is locked."))
            }
            //throw new ApiError(401, "password is not valid ")
            return res.status(400).json(new ApiResponse(400,null, "password is not valid."))
        }

        clearFailedLogin(user);

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
            throw new ApiError(400, " User not found....")
        }

        const data = {
            userId: loggedInUser.id,
            refreshToken: refreshToken,
            ipAddress: req.ip || req.socket?.remoteAddress || null,
            expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        }

        // insert data into session table
        await prisma.sessionManagement.create({data:data})

        // insert data into log table
        log.logStatus =  "Successful";
        await prisma.systemLog.create({data:log})

        const options = cookieOptions()

        // send response
        return res
        .status(200)
        .cookie("accessToken",accessToken,options)
        .cookie("refreshToken",refreshToken,options)
        .json(
            new ApiResponse(
                200,
                {
                    user: loggedInUser, accessToken, refreshToken
                },
                "User logged in Successfully"
            )
        )
    } catch (error) {
        logger.error("User login failed", error)
        return res.status(400).json(new ApiError(400, `something went wrong in login the user ${error?.message}`))
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
            await prisma.sessionManagement.deleteMany({
                where: {
                    userId: user.id,
                    refreshToken,
                },
            });
        }

        return res
        .status(200)
        .clearCookie("accessToken",options)
        .clearCookie("refreshToken",options)
        .json(
            new ApiResponse(200,{}, "User Logged out")
        )

    } catch (error) {
        logger.error("User logout failed", error)
        return res.status(400).json(new ApiError(400, `something went wrong in logout the user ${error?.message}`))
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

        log.logStatus =  "Successful";
        await prisma.systemLog.create({data:log})
        
        return res
        .status(200)
        .json(new ApiResponse(200, changePassword , "Password Changed Successfully"))

    } catch (error) {
        logger.error("User password change failed", error)
        return res.status(400).json(new ApiError(400, `something went wrong in change current password ${error?.message}`))
    }
})

const activeUser = asyncHandler(async(req, res)=>{
    try {
        const {token} = req.params

        //const user = await User.findByField("activation_token ='" + activation_token +"'") 
        //const user = await User.find({'activation_token':token}).execute()
        const user = await prisma.user.findFirst({
            where:{activationToken:token}
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
            activationToken:null
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
        return res.status(400).json(new ApiError(400, `something went wrong in change current password ${error?.message}`))
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
                    passwordResetToken: passwordResetToken,
                    passwordResetExpires: new Date(Date.now() + 30 * 60 * 1000),
                    isLocked: true
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
                    
                    return res.status(201).json(new ApiResponse(200, updateUser, " email send to user for reset password"))
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
        return res.status(400).json(new ApiError(400, `something went wrong in get User Detail ${error?.message}`))
    }
})

const forgetPassword = asyncHandler( async (req, res) =>{
    try{

        const {token} = req.params
        const {newPassword} = req.body
        assertStrongPassword(newPassword);
    
        //const user = await User.findByField("email='"+email+"'")
        //const user = await User.find({'activation_token':token}).execute()
        const user = await prisma.user.findFirst({
            where:{passwordResetToken:token}
        })

        if (!user) {
            return res.status(400).json(new ApiError(400, "Token is not active."))
        }

        const log={
            actorId: user.id,
            actorRole: user.role,
            description : `${user.firstName} ${user.lastName} reset the password`,
        }

        if(user.passwordResetToken == token && user.passwordResetExpires && user.passwordResetExpires > new Date()){
            const encryptNewPassword =  await bcrypt.hash(newPassword, 10)
            //const changePassword = await User.update({'id':user.id}, {password: encryptNewPassword, activation_token: null })
            const changePassword = await prisma.user.update({
                where:{id:user.id},
                data:{
                    isLocked:false,
                    password:encryptNewPassword,
                    passwordResetToken:null,
                    passwordResetExpires:null
                },
                select: publicUserSelect,
            })

            if(!changePassword){
                log.logStatus =  "Unsuccessful";
                await prisma.systemLog.create({data:log})
                throw new ApiError(400, " Issue while updateing the passowrd.")
            }
            
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
        return res.status(400).json(new ApiError(400, `something went wrong in forget password ${error?.message}`))
    }

})

// add pagination
const listUser = asyncHandler( async (req, res) =>{
    try{

        const users = await prisma.user.findMany({
            select: publicUserSelect,
        })

        //const users = await User.join("user_customers","user_customers.user_id = users.id").join("user_organizations", "user_organizations.user_id = users.id").find({},['password','activation_token']).execute();
        if(!users){
            return res.status(400).json(new ApiError(404, "No User Found"))
        }
        
        res.status(200).json(new ApiResponse(200,users, "List of all users"))

    }catch(error){
        return res.status(400).json(new ApiError(400, `something went wrong in list users ${error?.message}`))
    }
})


const getUserById = asyncHandler( async (req, res) =>{
    try{
        const {id} = req.body
        if(!id)throw new ApiError(400, " Id is empty")

        //const user = await User.find({'id':id},['password','activation_token']).execute();
        const user = await prisma.user.findUnique({
            where:{id:Number(id)},
            select: publicUserSelect,
        })

        if(!user){
            return res.status(404).json(new ApiResponse(404, null, " No user found "))
        }

        return res.status(200).json(new ApiResponse(200, user, " User found"))

    }catch(error){
        return res.status(400).json(new ApiError(400, `something went wrong in getting users ${error?.message}`))
    }
})

const updateUser = asyncHandler( async (req, res) =>{
    try{

        const {
            id,
            first_name,
            last_name, 
            email,
            mobile,
            role,
            assignedCustomer,
            assignedOrg,
            is_active
        } = req.body

        if([first_name,last_name,email,mobile,role].some((field) => field?.trim() === "")){
            return res.status(400).json(new ApiError(400,"All field are required" ))
        }        
        const normalizedEmail = normalizeEmail(email);
        assertValidEmail(normalizedEmail);

        const user = await prisma.user.update({
            where:{id:Number(id)},
            data:{
                firstName:first_name,
                lastName:last_name, 
                email:normalizedEmail,
                mobile:mobile,
                role:role,
                isActive:is_active
            },
            select: publicUserSelect,
        })

        const log={
            actorId: req.user?.id,
            actorRole: req.user?.role,
            description : `${req.user?.firstName} ${req.user?.lastName} update the detail of user_id ${req.body.id}`,
        }

        if(!user){
            log.logStatus =  "Unsuccessful";
            await prisma.systemLog.create({data:log})
            return res.status(400).json(new ApiError(400," Error while updating user"))
        }

        //update the assign customer 
        const userCustomerData = await Promise.all(
            assignedCustomer.map(customer =>
                prisma.userCustomer.update({
                    where: {
                            id: customer.id
                    },
                    data: {
                        userId: customer.userId,
                        customerId: customer.customerId
                    }
        })));
    

        //update the assign organization)
        const userOrganizationData = await Promise.all(
            assignedOrg.map(organization =>
                prisma.userOrganization.update({
                    where: {
                            id: organization.id
                    },
                    data: {
                        userId: organization.userId,
                        organizationId: organization.organizationId

                    }
        })));



        if(!userCustomerData || !userOrganizationData ){
            return res.status(400).json(new ApiError(400, " Error while updating the Customer and Organization"))
        }

        log.logStatus = "Successful";
        await prisma.systemLog.create({data:log})

        return res.status(200).json(new ApiResponse(200, user, " User updated successfully"))

    }catch(error){
        return res.status(400).json(new ApiError(500, `Error while updateing user :: ${error?.message}`))
    }
})

const toggleStatus = asyncHandler( async (req, res) =>{
    try {
        
        const {id} = req.query

        if(!id){
            return res.status(400).json(new ApiError(400, "All the field required"));
        }

        const userData = await prisma.user.findUnique({where:{id:Number(id)}})

        if(!userData){
            return res.status(404).json(new ApiError(404, "User not found"));
        }

        const user = await prisma.user.update({
            where:{id:Number(id)},
            data:{isActive:!userData.isActive},
            select: publicUserSelect,
        })


        if(!user){
            res.status(400).json(new ApiResponse(400, null, "Error while updating user status."))
        }

        const log={
            actorId: req.user.id,
            actorRole: req.user.role,
            description : `${req.user.firstName} ${req.user.lastName} has ${userData.isActive ? 'deactivated': 'activated'} the user ${userData.firstName} ${userData.lastName}`,
            logStatus: "Successful"
        }
        await prisma.systemLog.create({data:log})


        return res.status(200).json(new ApiResponse(200,user,"User status changed successfully"))

    } catch (error) {
        return res.status(400).json(new ApiError(400, `Error while changeing the status :: ${error?.message}`))
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
