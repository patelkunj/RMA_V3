import {ApiError} from "../utils/ApiError.js"
import {ApiResponse} from "../utils/ApiResponse.js"
import {asyncHandler} from "../utils/asyncHandler.js"
import {UserModel} from "../models/user.model.js"
// import {UserCustomerModel} from "../models/usercustomer.model.js"
// import { UserOrganizationModel } from "../models/userorganization.model.js"
import {SessionModel} from "../models/session.model.js"
import { LogModel } from "../models/log.model.js"
import moment from "moment"
import bcrypt from "bcrypt"
import jwt from "jsonwebtoken"
import { Email } from "../utils/Email.js"
import {signupEmailTempate} from "../templates/signup.templates.js"
import {generateRandomString, diffTwoDateTime} from "../utils/common.js"
import {resetPasswordTempate} from "../templates/resetPassword.template.js"
import { generateAccessToken, generateRefreshToken } from "../utils/tokenHandler.js"

import prisma from "../db/prisma.js";


//import Model from "../models/demo.model.js"


const User = new UserModel();
const UserCustomer = new UserCustomerModel();
const UserOrganization = new UserOrganizationModel();
const Session = new SessionModel();
const Log = new LogModel();



//const UserDataModel = new Model('users');

// Method for generate tokens  
// const generateAccessAndRefereshToken = async(user) => {

//     try{
//         const accessToken= jwt.sign(
//             {
//                 id:user.id,
//                 email:user.email
//                 //username:user.emp_user_id
//             },
//             process.env.ACCESS_TOKEN_SECRET,
//             {
//                 expiresIn: process.env.ACCESS_TOKEN_EXPIRY
//             }
//         )

//         const refreshToken= jwt.sign(
//             {
//                 id:user.id
//             },
//             process.env.REFRESH_TOKEN_SECRET,
//             {
//                 expiresIn: process.env.REFRESH_TOKEN_EXPIRY
//             }
//         )

//         return {accessToken, refreshToken}

//     }catch(error){
//         throw new ApiError(400, "something went wrong on generate token -> ", error)
//     }
// }

//TODO: Deactive user method
// const registerUser = asyncHandler(async (req,res) => {
//     try{
//             // get data from user
//             const {
//                 first_name,
//                 last_name, 
//                 email, 
//                 mobile,
//                 role,
//                 assigned_customer_id,
//                 assigned_org_id,
//             } = req.body

//             // validation of data
//             if([first_name,last_name,email,password,mobile,role,assigned_customer_id,assigned_org_id].some((field) => field?.trim() === "")){
//                 throw new ApiError(400, "All field are required")
//             }

//             // check if user is already exist 
//             //const existingUser =  await User.findByField("email ='" + email+"'")
//             const existingUser =  await User.find({'email':email}).execute();
//             if(existingUser){
//                 throw new ApiError(400,"User with email address is already exists !!!")
//             }
        
//             // encrypt the password and generate the activation token
//             const password = generateRandomString(12);
//             console.log("password value", password);
//             const encodepassword =  await bcrypt.hash(password, 10)
//             const activationToken = generateRandomString(55);
        
//             //create user object - create DB entry  
//             const user = await User.create({
//                 first_name,
//                 last_name, 
//                 email ,
//                 password:encodepassword, 
//                 mobile,
//                 role,
//                 is_active:0,
//                 is_locked:1, 
//                 activation_token: activationToken,

//             })
            
//             // remove add password and refresh token field from response
//             const userData = await User.find({'id':user}).execute();
            
//             const userCustomer = await UserCustomer.insertMany(userData.id,assigned_customer_id.split(","))
//             if(!userCustomer){
//                 return res.status(400).json(new ApiError(400, " Error while assiging the customer to user"))
//             }

//             const userOrgnization = await UserOrganization.insertMany(userData.id, assigned_org_id.split(","))
//             if(!userOrgnization){
//                 return res.status(400).json(new ApiError(400, " Error while assiging the organization to user"))
//             }

//             const createduser = await User.find({'id':user},['password','activation_token']).execute();

//             const log={
//                 actor_id: createduser.id,
//                 actor_role: createduser.role, 
//                 description : `${createduser.first_name + ' '+ createduser.last_name} is registered. `,
//                 created_date: moment().format("YYYY-MM-DD HH:mm:ss")
//             }
            
//             // check for user creation
//             if(createduser){
//                 //send email for active the account.
//                 const emailSend = await new Email().send(createduser.email,"RMA Service online account activation", signupEmailTempate(`http://localhost:3000/api/v1/users/activeuser/${createduser.activation_token}`)) 
                
//                 log.log_status =  "Successful";
//                 await Log.create(log)

//                 if(emailSend){
//                     return res.status(201).json(new ApiResponse(201, createduser, " User register successfully and send an activation email"))
//                 } 
//                 // return response 
//                 return res.status(201).json(new ApiResponse(201, createduser, " User register successfully and error while sending the email "))
             
//             }else{

//                 log.log_status =  "Failure";
//                 await Log.create(log)
//                 return res.status(500).json(new ApiError(500, "Something went wrong while adding user"))
//             }

//     }catch(error){
//         return res.status(400).json(new ApiError(400, `something went wrong in register the user ${error?.message}`))
//     }
// })





const registerUser = asyncHandler(async (req,res) => {
    try{
            const {
                first_name,
                last_name, 
                email, 
                mobile,
                role,
                assigned_customer_id,
                assigned_org_id,
            } = req.body


            // validation of data
            if([first_name,last_name,email,password,mobile,role,assigned_customer_id,assigned_org_id].some((field) => field?.trim() === "")){
                throw new ApiError(400, "All field are required")
            }

            const existingUser =    await prisma.User.count();
            if(existingUser){
                throw new ApiError(400,"User with email address is already exists !!!")
            }


            const password = generateRandomString(12);
            const encodepassword =  await bcrypt.hash(password, 10)
            const activationToken = generateRandomString(55);

            const user = await prisma.User.create({
                data:{
                    first_name,
                    last_name, 
                    email ,
                    password:encodepassword, 
                    mobile,
                    role,
                    is_active:0,
                    is_locked:1, 
                    activation_token: activationToken,
                }
            })

            const userData = await prisma.User.findUnique({
                where: { id: Number(user) },
            });


            const userCustomer = await prisma.UserCustomer.createMany(userData.id,assigned_customer_id.split(","))
            if(!userCustomer){
                return res.status(400).json(new ApiError(400, " Error while assiging the customer to user"))
            }


            const userOrgnization = await prisma.UserOrganization.createMany(userData.id, assigned_org_id.split(","))
            if(!userOrgnization){
                return res.status(400).json(new ApiError(400, " Error while assiging the organization to user"))
            }

            const createduser = await prisma.User.findUnique({
                where:{id:user},
                omit: {
                    password: true,
                    activation_token:true
                },
            });

            const log={
                actor_id: createduser.id,
                actor_role: createduser.role, 
                description : `${createduser.first_name + ' '+ createduser.last_name} is registered. `,
                created_date: moment().format("YYYY-MM-DD HH:mm:ss")
            }
            
            // check for user creation
            if(createduser){
                //send email for active the account.
                const emailSend = await new Email().send(createduser.email,"RMA Service online account activation", signupEmailTempate(`http://localhost:3000/api/v1/users/activeuser/${createduser.activation_token}`)) 
                
                log.log_status =  "Successful";
                await prisma.SystemLog.create({data:log})

                if(emailSend){
                    return res.status(201).json(new ApiResponse(201, createduser, " User register successfully and send an activation email"))
                } 
                // return response 
                return res.status(201).json(new ApiResponse(201, createduser, " User register successfully and error while sending the email "))
             
            }else{

                log.log_status =  "Failure";
                await prisma.SystemLog.create({data:log})
                return res.status(500).json(new ApiError(500, "Something went wrong while adding user"))
            }


    }catch(error){
        return res.status(400).json(new ApiError(400, `something went wrong in register the user ${error?.message}`))
    }
})



// //TODO: Add Lock account functionality. 
// const loginUser = asyncHandler( async (req, res) =>{

//     try{

//         // get data from user
//         const {email, password} = req.body;

//         // validate data 
//         if(!(email) && !(password)){
//             //throw new ApiError(400, " email and password are required")
//             return res.status(400).json(new ApiResponse(400,null, " Email and Password are required"))
//         }

//         // check user in db
//         const user = await User.find({'email': email}).execute();

//         if(!user){
//             //throw new ApiError(400,"User not found")
//             return res.status(400).json(new ApiResponse(400,null, "User not found."))
//         }

//         // check the active account 
//         if(user.is_active == 0 ){
//             return res.status(400).json(new ApiResponse(400,null, "User is not active. Please active the account or contact admin team."))   
//         }

//         const log={
//             actor_id: user.id,
//             actor_role:user.role,
//             description : `${user.first_name + " " + user.last_name} is login. `
//         }

//         // password check
//         const isPasswordValid = await User.isPasswordCorrect(password,user.password)
//         if(!isPasswordValid){
//             log.log_status =  "Faliure";
//             await Log.create(log)
//             //throw new ApiError(401, "password is not valid ")
//             return res.status(400).json(new ApiResponse(400,null, "password is not valid."))
//         }

//         // generae Accesstoken & refToken
//         const accessToken= await generateAccessToken(user)
//         const refreshToken= await generateRefreshToken(user)
//         //const {accessToken, refreshToken} = await generateAccessAndRefereshToken(user)

//         // send cookies
//         //const loggedInUser= await User.findById(user.id)
//         const loggedInUser= await User.find({id:user.id},['password','activation_token']).execute();

//         if(!loggedInUser){
//             throw new ApiError(400, " User not found....")
//         }

//         const data = {
//             user_id: loggedInUser.id,
//             jwt_token: accessToken,
//             refresh_token: refreshToken,
//             created_date: moment().format("YYYY-MM-DD HH:mm:ss"), 
//         }

//         // insert data into session table
//         await Session.create(data)

//         // insert data into log table
//         log.log_status =  "Successful";
//         await Log.create(log)

//         const options = {
//             httpOnly : true,
//             secure: false,
//             sameSite: "Lax",
//             maxAge: 3600000
//         }

//         // send response
//         return res
//         .status(200)
//         .cookie("accessToken",accessToken,options)
//         .cookie("refreshToken",refreshToken,options)
//         .json(
//             new ApiResponse(
//                 200,
//                 {
//                     user: loggedInUser, accessToken, refreshToken
//                 },
//                 "User logged in Successfully"
//             )
//         )
//     }catch(error){
//         console.log(" User Controller :: Login User :: error ", error)
//         return res.status(400).json(new ApiError(400, `something went wrong in login the user ${error?.message}`))
//     }

// })


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
        if(user.is_active == 0 ){
            return res.status(400).json(new ApiResponse(400,null, "User is not active. Please active the account or contact admin team."))   
        }

        const log={
            actor_id: user.id,
            actor_role:user.role,
            description : `${user.first_name + " " + user.last_name} is login. `
        }

        // password check
        //const isPasswordValid = await User.isPasswordCorrect(password,user.password)
        const isPasswordValid = await bcrypt.compare(password,user.password)


        if(!isPasswordValid){
            log.log_status =  "Faliure";
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
                activation_token:true
            }
        })

        if(!loggedInUser){
            throw new ApiError(400, " User not found....")
        }

        const data = {
            user_id: loggedInUser.id,
            jwt_token: accessToken,
            refresh_token: refreshToken,
            created_date: moment().format("YYYY-MM-DD HH:mm:ss"), 
        }

        // insert data into session table
        await Session.create(data)

        // insert data into log table
        log.log_status =  "Successful";
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

// const logoutUser = asyncHandler( async (req, res) =>{
//     try{

//         // Add JWT token into Database 
//         const user = req.user
//         //const user = User.findByField("id='"+userid+"'")
    
//         const log={
//             actor_id: user.id,
//             actor_role:user.role,
//             description : `${user.first_name + " " + user.last_name} did the logout`,
//             log_status: "Successful",
//         }
//         await Log.create(log)

//         // remove cookies
//         const options = {
//             httpOnly : true,
//             secure: true
//         }

//         return res
//         .status(200)
//         .clearCookie("accessToken",options)
//         .clearCookie("refreshToken",options)
//         .json(
//             new ApiResponse(200,{}, "User Logged out")
//         )

//     }catch(error){
//         console.log("User COntroller :: Logout :: error ", error)
//     }

// })


const logoutUser = asyncHandler(async(req,res)=>{
    try {
        
        // Add JWT token into Database 
        const user = req.user
        //const user = User.findByField("id='"+userid+"'")
    
        const log={
            actor_id: user.id,
            actor_role:user.role,
            description : `${user.first_name + " " + user.last_name} did the logout`,
            log_status: "Successful",
        }
        await Log.create(log)

        // remove cookies
        const options = {
            httpOnly : true,
            secure: true
        }

        return res
        .status(200)
        .clearCookie("accessToken",options)
        .clearCookie("refreshToken",options)
        .json(
            new ApiResponse(200,{}, "User Logged out")
        )

    } catch (error) {
        console.log("User COntroller :: Logout :: error ", error)
        return res.status(400).json(new ApiError(400, `something went wrong in login the user ${error?.message}`))
    }
})



const changeCurrentPassword = asyncHandler( async (req, res) =>{

    try{
        const {oldPassword, newPassword} = req.body

        //const user = await User.findById(req.user?.id)
        const user = req.user
        const isPasswordCorrect = await User.isPasswordCorrect(oldPassword, user.password)

        if(!isPasswordCorrect){
            return res.status(400).json(new ApiError(400, "Invalid old Password."))
        }

        const encryptNewPassword =  await bcrypt.hash(newPassword, 10)
        const changePassword = await User.update({'id':user.id}, {password: encryptNewPassword})

        const log={
            actor_id: user.id,
            actor_role: user.role,
            description : `${user.first_name + " " + user.last_name} change the password`,
            created_date: moment().format("YYYY-MM-DD HH:mm:ss")
        }

        if(!changePassword){
            log.log_status =  "Unsuccessful";
            await Log.create(log)
            return res.status(400).json(new ApiError(400, " Issue while updateing the passowrd."))
        }

        log.log_status =  "Successful";
        await Log.create(log)
        
        return res
        .status(200)
        .json(new ApiResponse(200, changePassword , "Password Changed Successfully"))
    }catch(error){
        console.log("User Controller :: Changerpassword :: error", error)
    }
})

const activeuser = asyncHandler( async (req, res) =>{

    try{
        const {token} = req.params

        //const user = await User.findByField("activation_token ='" + activation_token +"'") 
        const user = await User.find({'activation_token':token}).execute()

        if(!user){
            return res.status(400).json(new ApiError(400,"Token is not recognised."))
        }

        const log={
            actor_id: user.id,
            actor_role: user.role,
            description : `${user.first_name + " " + user.last_name} is activated`,
            created_date: moment().format("YYYY-MM-DD HH:mm:ss")
        }

        const data = {
            is_active:true,
            is_locked:false,
            activation_token:null
        };
          
        const timeDiffernce = diffTwoDateTime(moment().format("YYYY-MM-DD HH:mm:ss"),user.created_date)

        let updateUser = null;
        if(user ){
            if(timeDiffernce.hours < 24 &&  timeDiffernce.minutes < 1440 ){
                updateUser = await User.update({'id':user.id}, data)

                if(!updateUser){
                    log.log_status =  "Unsuccessful";
                    await Log.create(log)     
                    throw new ApiError(400,"error while updating activated the user account.")
                }else{
                    log.log_status =  "Successful";
                    await Log.create(log)
                    return res.status(200).json(new ApiResponse(200, updateUser, "user account is activated successfully."))
                }
            }else{
                log.log_status =  "Unsuccessful";
                await Log.create(log) 
                throw new ApiError(400," Token is expired.")
            }
        }else{
            log.log_status =  "Unsuccessful";
            await Log.create(log) 
            throw new ApiError(400," Token is not recognised.")
        }

    }catch(error){
        console.log("User Controller :: Active User :: error ", error)
    }

})

const getUserDetail = asyncHandler( async (req, res) =>{
    try{

        const {email} = req.body
        //const user = await User.findByField("email='"+email+"'")
        const user = await User.find({'email':email}).execute();
        if(user){
            const activationToken = generateRandomString(55);
            const data = {
                activation_token: activationToken
            };

            const updateUser = await User.update({'id':user.id}, data)
            if(updateUser){
                const emailSend = await new Email().send(updateUser.email,"Reset Password", resetPasswordTempate(`http://localhost:3000/api/v1/users/activeuser/${updateUser.activation_token}`)) 
    
                if(emailSend){
                    return res.status(201).json(new ApiResponse(200, createduser, " email send to user for reset password"))
                }
                return res.status(400).json(new ApiError(400," Error while sending the email."))
            }else{
                return res.status(400).json(new ApiError(400," Error while storeing token."))
            }
        }else{
            return new ApiError(404," email address is not found. ") 
        }

    }catch(error){
        console.log(" UserController :: getUserDetail :: error ", error)
    }
})

const forgetPassword = asyncHandler( async (req, res) =>{
    try{
        try{

            const {token} = req.params
            const {newPassword} = req.body
        
            //const user = await User.findByField("email='"+email+"'")
            const user = await User.find({'activation_token':token}).execute()
            
            const log={
                actor_id: user.id,
                actor_role: user.role,
                description : `${user.first_name + " " + user.last_name} reset the password`,
                created_date: moment().format("YYYY-MM-DD HH:mm:ss")
            }

            if(user.activation_token == token){
                const encryptNewPassword =  await bcrypt.hash(newPassword, 10)
                const changePassword = await User.update({'id':user.id}, {password: encryptNewPassword, activation_token: null })

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
            console.log("User Controller :: Changerpassword :: error", error.message)
        }
    }catch(error){
        console.log('User Controller :: forgetPassword :: error ', error.message )
    }

})

// add pagination
const listUser = asyncHandler( async (req, res) =>{
    try{

        // Get page and limit from query params, default to page 1, limit 10
        // let page = parseInt(req.body.page) || 1;
        // let limit = parseInt(req.body.limit) || 10;
        // let offset = (page - 1) * limit;

        // const users = await User.findAll(limit,offset,['password','activation_token'] )
        const users = await User.find({},['password','activation_token']).execute();
        //const users = await User.join("user_customers","user_customers.user_id = users.id").join("user_organizations", "user_organizations.user_id = users.id").find({},['password','activation_token']).execute();
        if(!users){
            throw ApiError(404, "No User Found")
        }
        
        res.status(200).json(new ApiResponse(200,users, "List of all users"))

    }catch(error){
        throw ApiError(400, "Error while listing users. ")
    }
})




const getUserById = asyncHandler( async (req, res) =>{
    try{
        const {id} = req.body
        if(id == "")throw new ApiError(400, " Id is empty")

        const user = await User.find({'id':id},['password','activation_token']).execute();
        if(!user){
            throw new ApiError(400, " No user found with id")
        }

        res.status(200).json(new ApiResponse(200, user, " User found"))

    }catch(error){
        throw new ApiError(400, " Error while listing user by it's id")
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
            assigned_customer_id,
            assigned_org_id,
            assign_type, 
            is_active
        } = req.body

        if([first_name,last_name,email,mobile,role,assign_type].some((field) => field?.trim() === "")){
            return res.status(400).json(new ApiError(400,"All field are required" ))
        }        

        const user = await User.update({'id':id},
            {
                first_name,
                last_name, 
                email,
                mobile,
                role,
                is_active,
                updated_date : moment().format("YYYY-MM-DD HH:mm:ss")
            }
        )

        const log={
            actor_id: req.user?.id,
            actor_role: req.user?.role,
            description : `${req.user?.first_name + " " + req.user?.last_name} update the detail of user_id ${req.body.id}`,
        }

        if(!user){
            log.log_status =  "Unsuccessful";
            await Log.create(log)
            return res.status(400).json(new ApiError(400," Error while updating user"))
        }

        //update the assign customer 
        const userCustomerData = await UserCustomer.updateMany(id,assigned_customer_id.split(","))

        //update the assign organization
        const userOrganizationData = await UserOrganization.updateMany(id, assigned_org_id.split(","))


        if(!userCustomerData || !userOrganizationData ){
            return res.status(400).json(new ApiError(400, " Error while updating the Customer and Organization"))
        }

        const update_user = await User.find({id:req.body.id},['password','activation_token']).execute();

        log.log_status =  "Successful";
        await Log.create(log)

        res.status(200).json(new ApiResponse(200, update_user, " User updated successfully"))

    }catch(error){
        throw new ApiError(500, `Error while updateing user :: ${error?.message}`)
    }
})

const toggleStatus = asyncHandler( async (req, res) =>{
    try {
        
        const {id} = req.query

        if(!id){
            return res.status(400).json(new ApiError(400, "All the field required"));
        }

        const userData = await User.find({'id':id}).execute();

        const user = await User.update({'id':id},{
            is_active: !userData.is_active
        })

        if(!user){
            throw new ApiError(400," Error while updating user status.")
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
        throw new ApiError(400," Error while changeing the status.")
    }
})

const searchUser = asyncHandler(async(req,res)=>{
    try {
        const {searchTerm} = req.body
        if(!searchTerm){
            throw new ApiError(400,"search field is empty.")
        }
        const users = await User.search(searchTerm)
        if(!users){
            throw new ApiError(400," No user found")
        }
        res.status(200).json(new ApiResponse(200,users, " user list."))


    } catch (error) {
        throw new ApiError(400," Error While searching user.")
    }
})

export { registerUser, 
         loginUser, 
         logoutUser, 
         changeCurrentPassword, 
         activeuser,
         getUserDetail,
         forgetPassword,
         listUser,
         getUserById,
         updateUser,
         toggleStatus,
         searchUser
        }