import {ApiError} from "../utils/ApiError.js"
import {ApiResponse} from "../utils/ApiResponse.js"
import {asyncHandler} from "../utils/asyncHandler.js"
import moment from "moment"
import bcrypt from "bcrypt"
import jwt from "jsonwebtoken"
import { Email } from "../utils/Email.js"
import {signupEmailTempate} from "../templates/signup.templates.js"
import {generateRandomString, diffTwoDateTime} from "../utils/common.js"
import {resetPasswordTempate} from "../templates/resetPassword.template.js"
import { generateAccessToken, generateRefreshToken } from "../utils/tokenHandler.js"

import prisma from "../db/prisma.js";
import { dmmfToRuntimeDataModel } from "@prisma/client/runtime/library"

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
            if([firstName,lastName,email,mobile,role,assignedCustomerId,assignedOrgId].some((field) => field?.trim() === "")){
                throw new ApiError(400, "All field are required")
            }

            const existingUser = await prisma.User.count({
                where:{email}
            });

            if(existingUser){
                throw new ApiError(400,"User with email address is already exists !!!")
            }

            const password = generateRandomString(12);
            const encodepassword =  await bcrypt.hash(password, 10)
            const activationToken = generateRandomString(55);

            const user = await prisma.User.create({
                data:{
                    firstName,
                    lastName, 
                    email ,
                    password:encodepassword, 
                    mobile,
                    role,
                    isActive:false,
                    isLocked:true, 
                    activationToken: activationToken
                },
                omit:{
                    password:true,
                    activationToken:true,
                    passwordResetToken:true,
                    passwordResetExpires:true
                }
            })


            console.log("password", password)


            const orgIds = assignedOrgId.split(",").map(id => ({
                userId:user.id,
                organizationId: Number(id.trim())
            }));


            const userOrganization = await prisma.UserOrganization.createMany({
                data:orgIds
            })


            const customerIds = assignedCustomerId.split(",").map(id=>({
                userId:user.id,
                customerId:Number(id.trim())
            }))

            const userCustomer = await prisma.UserCustomer.createMany({
                data:customerIds
            })

            const log={
                actorId: user.id,
                actorRole: user.role, 
                description : `${user.firstName + ' '+ user.lastName} is registered. `,
            }
            
            // check for user creation
            if(user){
                //send email for active the account.
                const emailSend = await new Email().send(user.email,"RMA Service online account activation", signupEmailTempate(`http://localhost:3000/api/v1/users/activeuser/${createduser.activation_token}`)) 
                
                log.logStatus =  "Successful";
                await prisma.SystemLog.create({data:log})

                if(emailSend){
                    return res.status(201).json(new ApiResponse(201, user, " User register successfully and send an activation email"))
                } 
                // return response 
                return res.status(201).json(new ApiResponse(201, user, " User register successfully and error while sending the email "))
             
            }else{

                log.logStatus =  "Failure";
                await prisma.SystemLog.create({data:log})
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
        if(!(email) && !(password)){
            //throw new ApiError(400, " email and password are required")
            return res.status(400).json(new ApiResponse(400,null, " Email and Password are required"))
        }

        // check user in db
        const user = await prisma.User.findUnique({where:{email: email}});

        if(!user){
            //throw new ApiError(400,"User not found")
            return res.status(400).json(new ApiResponse(400,null, "User not found."))
        }

        // check the active account 
        if(user.isActive == false){
            return res.status(400).json(new ApiResponse(400,null, "User is not active. Please active the account or contact admin team."))   
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
            await prisma.SystemLog.create({data:log})
            //throw new ApiError(401, "password is not valid ")
            return res.status(400).json(new ApiResponse(400,null, "password is not valid."))
        }

        // generae Accesstoken & refToken
        const accessToken= await generateAccessToken(user)
        const refreshToken= await generateRefreshToken(user)
        //const {accessToken, refreshToken} = await generateAccessAndRefereshToken(user)

        // send cookies
        //const loggedInUser= await User.findById(user.id)
        const loggedInUser= await prisma.User.findUnique({
            where:{id:user.id},
            omit:{
                password:true,
                activationToken:true,
                passwordResetToken:true,
                passwordResetExpires:true
            }
        })

        if(!loggedInUser){
            throw new ApiError(400, " User not found....")
        }

        const data = {
            userId: loggedInUser.id,
            refreshToken: refreshToken,
        }

        // insert data into session table
        await prisma.SessionManagement.create({data:data})

        // insert data into log table
        log.logStatus =  "Successful";
        await prisma.SystemLog.create({data:log})

        const options = {
            httpOnly : true,
            secure: false,
            sameSite: "Lax",
            maxAge: 3600000
        }

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
        console.log(" User Controller :: Login User :: error ", error)
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
            description : `${user.first_name + " " + user.last_name} did the logout`,
            logStatus: "Successful",
        }

        // remove cookies
        const options = {
            httpOnly : true,
            secure: true
        }

        await prisma.SystemLog.create({data:log})

        return res
        .status(200)
        .clearCookie("accessToken",options)
        .clearCookie("refreshToken",options)
        .json(
            new ApiResponse(200,{}, "User Logged out")
        )

    } catch (error) {
        console.log("User COntroller :: Logout :: error ", error)
        return res.status(400).json(new ApiError(400, `something went wrong in logout the user ${error?.message}`))
    }
})

const changeCurrentPassword = asyncHandler(async(req, res) =>{
    try {

        const {oldPassword, newPassword} = req.body

        //const user = await User.findById(req.user?.id)
        const user = req.user
        //const isPasswordCorrect = await prisma.User.isPasswordCorrect(oldPassword, user.password)
        const isPasswordCorrect = await bcrypt.compare(oldPassword, user.password)

        if(!isPasswordCorrect){
            return res.status(400).json(new ApiError(400, "Invalid old Password."))
        }

        const encryptNewPassword =  await bcrypt.hash(newPassword, 10)
        const changePassword = await prisma.User.update({
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
            description : `${user.first_name + " " + user.last_name} change the password`,
        }

        if(!changePassword){
            log.logStatus =  "Unsuccessful";
            await prisma.SystemLog.create({data:log})
            return res.status(400).json(new ApiError(400, " Issue while updateing the passowrd."))
        }

        log.logStatus =  "Successful";
        await prisma.SystemLog.create({data:log})
        
        return res
        .status(200)
        .json(new ApiResponse(200, changePassword , "Password Changed Successfully"))

    } catch (error) {
        console.log("User Controller :: Changerpassword :: error", error)
        return res.status(400).json(new ApiError(400, `something went wrong in change current password ${error?.message}`))
    }
})

const activeUser = asyncHandler(async(req, res)=>{
    try {
        const {token} = req.params

        //const user = await User.findByField("activation_token ='" + activation_token +"'") 
        //const user = await User.find({'activation_token':token}).execute()
        const user = await prisma.User.findUnique({
            where:{activationToken:token}
        })

        if(!user){
            return res.status(400).json(new ApiError(400,"Token is not recognised."))
        }

        const log={
            actorId: user.id,
            actorRole: user.role,
            description : `${user.first_name + " " + user.last_name} is activated`,
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
                updateUser = await User.update({
                    where:{id:user.id}, 
                    data : data,
                    omit:{
                    password:true,
                    activationToken:true,
                    passwordResetToken:true,
                    passwordResetExpires:true
                }
                })

                if(!updateUser){
                    log.logStatus =  "Unsuccessful";
                    await prisma.SystemLog.create({data:log})
                    throw new ApiError(400,"error while updating activated the user account.")
                }else{
                    log.logStatus =  "Successful";
                    await prisma.SystemLog.create({data:log})
                    return res.status(200).json(new ApiResponse(200, updateUser, "user account is activated successfully."))
                }
            }else{
                log.logStatus =  "Unsuccessful";
                await prisma.SystemLog.create({data:log})
                throw new ApiError(400," Token is expired.")
            }
        }else{
            log.logStatus =  "Unsuccessful";
            await prisma.SystemLog.create({data:log})
            throw new ApiError(400," Token is not recognised.")
        }

    } catch (error) {
        console.log("User Controller :: Active User :: error ", error)
        return res.status(400).json(new ApiError(400, `something went wrong in change current password ${error?.message}`))
    }
})


const getUserDetail = asyncHandler( async (req, res) =>{
    try{

        const {email} = req.body
        //const user = await User.findByField("email='"+email+"'")
        //const user = await User.find({'email':email}).execute();
        const user = await prisma.User.findUnique({
            where:{email:email},
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
            description : `${user.first_name + " " + user.last_name} is activated`,
        }


        if(user){
            const passwordResetToken = generateRandomString(55);

            // const updateUser = await User.update({'id':user.id}, data)
            const updateUser = await prisma.User.update({
                where:{id:user.id},
                data:{
                    passwordResetToken: passwordResetToken,
                    isLocked: true
                },
                omit:{
                    password:true,
                    activationToken:true,
                    passwordResetToken:true,
                    passwordResetExpires:true
                }
            })

            if(updateUser){
                const emailSend = await new Email().send(updateUser.email,"Reset Password", resetPasswordTempate(`http://localhost:3000/api/v1/users/activeuser/${updateUser.activation_token}`)) 
                
                if(emailSend){
                    log.logStatus =  "Successful";
                    await prisma.SystemLog.create({data:log})
                    
                    return res.status(201).json(new ApiResponse(200, updateUser, " email send to user for reset password"))
                }

                log.logStatus =  "Unsuccessful";
                await prisma.SystemLog.create({data:log})
                
                return res.status(400).json(new ApiError(400," Error while sending the email."))
            }else{
                return res.status(400).json(new ApiError(400," Error while storeing token."))
            }
        }else{
            return new ApiError(404," email address is not found. ") 
        }

    }catch(error){
        console.log(" UserController :: getUserDetail :: error ", error)
        return res.status(400).json(new ApiError(400, `something went wrong in get User Detail ${error?.message}`))
    }
})

const forgetPassword = asyncHandler( async (req, res) =>{
    try{

        const {token} = req.params
        const {newPassword} = req.body
    
        //const user = await User.findByField("email='"+email+"'")
        //const user = await User.find({'activation_token':token}).execute()
        const user = await prisma.User.findUnique({
            where:{activationToken:token}
        })


        const log={
            actorId: user.id,
            actorRole: user.role,
            description : `${user.first_name + " " + user.last_name} reset the password`,
        }

        if(user.activationToken == token){
            const encryptNewPassword =  await bcrypt.hash(newPassword, 10)
            //const changePassword = await User.update({'id':user.id}, {password: encryptNewPassword, activation_token: null })
            const changePassword = await prisma.User.update({
                where:{id:user.id},
                data:{
                    isLocked:false,
                    password:encryptNewPassword,
                    activationToken:null
                },
                omit:{
                    password:true,
                    activationToken:true,
                    passwordResetToken:true,
                    passwordResetExpires:true
                }
            })

            if(!changePassword){
                log.log_status =  "Unsuccessful";
                await Log.create(log)
                throw new ApiError(400, " Issue while updateing the passowrd.")
            }
            
            log.log_status =  "Successful";
            await Log.create(log)

            return res
            .status(200)
            .json(new ApiResponse(200, changePassword , "Password Changed Successfully"))
        }else{
            return res.status(400).json(new ApiError(400, "Token is not active."))
        }

    }catch(error){
        console.log('User Controller :: forgetPassword :: error ', error.message )
        return res.status(400).json(new ApiError(400, `something went wrong in forget password ${error?.message}`))
    }

})

// add pagination
const listUser = asyncHandler( async (req, res) =>{
    try{

        const users = await prisma.User.findMany({
            omit:{
                password:true,
                activationToken:true,
                passwordResetToken:true,
                passwordResetExpires:true
            }
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
        const user = await prisma.User.findUnique({
            where:{id:id},
            omit:{
                password:true,
                activationToken:true,
                passwordResetToken:true,
                passwordResetExpires:true
            }
        })

        if(!user){
            res.status(200).json(new ApiResponse(200, null, " No user found "))
        }

        res.status(200).json(new ApiResponse(200, user, " User found"))

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

        const user = await prisma.User.update({
            where:{id:id},
            data:{
                firstName:first_name,
                lastName:last_name, 
                email:email,
                mobile:mobile,
                role:role,
                isActive:is_active
            },
            omit:{
                password:true,
                activationToken:true,
                passwordResetToken:true,
                passwordResetExpires:true
            }
        })

        const log={
            actorId: req.user?.id,
            actorRole: req.user?.role,
            description : `${req.user?.first_name + " " + req.user?.last_name} update the detail of user_id ${req.body.id}`,
        }

        if(!user){
            log.logStatus =  "Unsuccessful";
            await prisma.SystemLogLog.create({data:log})
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
                prisma.UserOrganization.update({
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
        await prisma.SystemLogLog.create({data:log})

        res.status(200).json(new ApiResponse(200, update_user, " User updated successfully"))

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

        const userData = await prisma.User.findUnique({where:{id:id}})

        const user = await prisma.User.update({
            where:{id:id},
            data:{isActive:!userData.is_active},
            omit:{
                password:true,
                activationToken:true,
                passwordResetToken:true,
                passwordResetExpires:true
            }
        })


        if(!user){
            res.status(400).json(new ApiResponse(400, null, "Error while updating user status."))
        }

        const log={
            actor_id: req.user.id,
            actor_role: req.user.role,
            description : `${req.user.first_name + " " + req.user.last_name} has ${userData.is_active == 0 ? 'activated': 'deactivated'} the user ${userData.first_name +" "+ userData.last_name}`,
            log_status: "Successful"
        }
        await Log.create(log)   


        res.status(200).json(new ApiResponse(200,user,"User status changed successfully"))

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