import {ApiError} from "../utils/ApiError.js"
import {ApiResponse} from "../utils/ApiResponse.js"
import {asyncHandler} from "../utils/asyncHandler.js"
import {CustomerModel} from "../models/customer.model.js"
import {UserCustomerModel} from "../models/usercustomer.model.js"
import {OrganizationModel} from "../models/organization.model.js"
import {SessionModel} from "../models/session.model.js"
import {LogModel} from "../models/log.model.js"
import moment from "moment"
import bcrypt, { compare } from "bcrypt"
import jwt from "jsonwebtoken"
import { Email } from "../utils/Email.js"
import {signupEmailTempate} from "../templates/signup.templates.js"
import {resetPasswordTempate} from "../templates/resetPassword.template.js"
import {generateRandomString, diffTwoDateTime} from "../utils/common.js"
import { generateAccessToken, generateRefreshToken } from "../utils/tokenHandler.js"


const Customer = new CustomerModel();
const Session = new SessionModel();
const Log = new LogModel();
const UserCustomer = new UserCustomerModel();
const Org = new OrganizationModel();

// Method for generate tokens  
// TODO: Need to revise the method

// const generateAccessAndRefereshToken = async(user) => {

//     try{
//         const accessToken= jwt.sign(
//             {
//                 id:user.id,
//                 email:user.email,
//                 company_name:user.company_name
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

const registerCustomer = asyncHandler(async (req,res) => {
    try{
            // get data from user
            const {
                organization_id,
                company_name,
                email,
                contact_person_name,
                contact_person_email,
                mobile,
                return_address,
                //organization,
                warranty_months,
                warranty_type,
                doa_warranty_days,
                doa_warranty_type,
                warranty_remarks,
                is_pickup_faulty,
                sales_person,
            } = req.body 

            // validation of data
            if([company_name,email,contact_person_name,contact_person_email,return_address,warranty_months, warranty_type, doa_warranty_days, doa_warranty_type,sales_person].some((field) => field?.trim() === "")){
                return res.status(400).json(new ApiError(400, "All field are required"))
            }

            // check if user is already exist 
            //const existingUser =  await Customer.findByField("company_name='" + company_name+"'")
            const existingUser =  await Customer.find({'company_name':company_name, 'email':email}).execute()

            if(existingUser){
                return res.status(400).json(new ApiError(400,"Customer with company name is already exists !!!"))
            }

            // generate the store code/ customer code
            const org = await Org.find({'id':organization_id}).execute();
            const last_StoreCode = await Customer.selectFields('id').orderBy('id',"DESC").limit(1).execute();
            let Store_code = last_StoreCode ? `${org.alias}${String(Number(last_StoreCode.id) + 1 ).padStart(2, '0')}` : `${org.alias}01`  ; 

        
            // encrypt the password and generate the activation token
            const encodepassword =  await bcrypt.hash(generateRandomString(16), 10)
            const activationToken = generateRandomString(55);

            // create user object - create DB entry
            const customer = await Customer.create({
                company_name,
                store_code: Store_code,
                email,
                password:encodepassword,
                contact_person_name,
                contact_person_email,
                mobile,
                return_address,
                //organization_id: Number(organization.value) ,
                organization_id,
                warranty_months: Number(warranty_months),
                warranty_type,
                doa_warranty_days: Number(doa_warranty_days),
                doa_warranty_type,
                warranty_remarks,
                is_pickup_faulty,
                sales_person, 
                is_active:0,
                is_locked:1, 
                activation_token: activationToken,
                created_date : moment().format("YYYY-MM-DD HH:mm:ss"),
                updated_date : moment().format("YYYY-MM-DD HH:mm:ss")
            });

            // remove add password and refresh token field from response
            const createdcustomer = await Customer.find({id:customer},['password','activation_token']).execute();

            const log={
                actor_id: req.user?.id,
                actor_role: req.user?.role, 
                description : `Register a customer - ${createdcustomer.company_name}`,
                created_date: moment().format("YYYY-MM-DD HH:mm:ss")
            }

            // check for customer creation
            if(createdcustomer){
                // Assign Customer in to All the user with Full Assign type.
                // const customer_id = "," + customer;
                //await User.assignStore(customer_id)


                //send email for active the account.
                const emailSend = await new Email().send(createdcustomer.email,"RMA Service online account activation", signupEmailTempate(`http://localhost:3000/api/v1/customers/activecustomer/${createdcustomer.activation_token}`)) 
                
                log.log_status =  "Successful";
                await Log.create(log)

                if(emailSend){
                    return res.status(200).json(new ApiResponse(200, createdcustomer, " Customer register successfully and send an activation email"))
                } 
                // return response 
                return res.status(201).json(new ApiResponse(201, createdcustomer, " Customer register successfully and error while sending the email "))
             
            }else{

                log.log_status =  "Failure";
                await Log.create(log)
                return res.status(400).json(new ApiResponse(400,"something went wrong in register the customer"))
            }

    }catch(error){
        const log={
            actor_id: req.user.id,
            actor_role: req.user.role, 
            description : `${error.message}`,
            created_date: moment().format("YYYY-MM-DD HH:mm:ss"),
            log_status: "Failure"
        }
        await Log.create(log)
        return res.status(400).json(new ApiResponse(400,"something went wrong in register the customer"))
    }
    
})

const loginCustomer = asyncHandler( async (req, res) =>{

    try{

        // get data from user
        const {email, password} = req.body;

        // validate data 
        if(!(email) && !(password)){
            return res.status(400).json(new ApiError(400, " email and password are required"))
        }

        // check user in db
        //const customer = await Customer.findByField("email ='" + email+"'")
        const customer = await Customer.find({'email':email}).execute();

        if(!customer){
            return res.status(400).json(ApiError(400,"please enter correct email address."))
        }

        const log={
            actor_id: customer.id,
            actor_role: "customer", 
            description : `${customer.company_name} login into the system.`
        }


        // password check
        const isPasswordValid = await Customer.isPasswordCorrect(password,customer.password)
        if(!isPasswordValid){
            log.log_status =  "Faliure";
            await Log.create(log)
            return res.status(401).json(new ApiError(401, "password is not valid "))
        }

        // generae Accesstoken & refToken
        //const {accessToken, refreshToken} = await generateAccessAndRefereshToken(customer)
        const accessToken = await generateAccessToken(customer)
        const refreshToken = await generateRefreshToken(customer)

        // send cookies
        //const loggedInUser= await User.findById(user.id)
        const loggedInCustomer = await Customer.find({id:customer.id},['password','activation_token']).execute();

        if(!loggedInCustomer){
            return res.status(400).json(new ApiError(400,"Customer not found...."))
        }

        const data = {
            user_id: loggedInCustomer.id,
            jwt_token: accessToken,
            refresh_token: refreshToken,
        }

        // insert data into session table
        await Session.create(data)

        // insert data into log table
        log.log_status =  "Successful";
        await Log.create(log)

        const options = {
            httpOnly : true,
            secure: true,
            sameSite: "Strict"
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
                    user: loggedInCustomer, accessToken, refreshToken
                },
                "Customer login successfully"
            )
        )
    }catch(error){
        console.log(" Customer Controller :: Login Customer :: error ", error?.message)
    }

})

const logoutCustomer = asyncHandler( async (req, res) =>{

    try{

        // Add JWT token into Database 
        const customer = await Customer.find({'id':req.customer?.id}).execute();

        if(!customer){
            res.status(403).json(new ApiResponse(403, null, "Forbidden: Something is worng to process logout."))
        }

        const log={
            actor_id: customer.id,
            actor_role: "customer", 
            description : `${customer.company_name} did the logout`,
            log_status: "Successful",
            created_date: moment().format("YYYY-MM-DD HH:mm:ss")
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
            new ApiResponse(200,{}, "Customer Logged out")
        )

    }catch(error){
        console.log("Customer COntroller :: Logout :: error ", error?.message)
    }

})

const changeCurrentPassword = asyncHandler( async (req, res) =>{

    try{
        const {oldPassword, newPassword} = req.body
    
        const customer = await Customer.find({'id':req.customer?.id}).execute()
        const isPasswordCorrect = await Customer.isPasswordCorrect(oldPassword, customer.password)

        if(!isPasswordCorrect){
            throw new ApiError(400, "Invalid Password")
        }

        const encryptNewPassword =  await bcrypt.hash(newPassword, 10)
        const changePassword = await Customer.update({'id':customer.id}, {password: encryptNewPassword})

        const log={
            actor_id: customer.id,
            actor_role: "customer",
            description : `${customer.company_name} change the password`,
            created_date: moment().format("YYYY-MM-DD HH:mm:ss")
        }

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
    }catch(error){
        console.log("Customer Controller :: Changerpassword :: error", error?.message)
    }
})

const activeCustomer = asyncHandler( async (req, res) =>{

    try{
        const {token} = req.params

        const customer = await Customer.find({'activation_token':token}).execute();

        if(!customer){
            return res.status(400).json(new ApiError(400, " Error while activating account."))
        }

        const log={
            actor_id: customer.id,
            actor_role: "customer",
            description : `${customer.company_name} account is activated. `
        }

        const data = {
            is_active:true,
            is_locked:false,
            activation_token:null
        };
          
        const timeDiffernce = diffTwoDateTime(moment().format("YYYY-MM-DD HH:mm:ss"),customer.created_date)

        if(customer){
            if(timeDiffernce.hours < 24 &&  timeDiffernce.minutes < 1440 ){
                const updateCustomer = await Customer.update({'id':customer.id}, data)
 
                if(!updateCustomer){
                    log.log_status =  "Unsuccessful";
                    await Log.create(log)
                    return res.status(400). json(new ApiError(400,"error while updating activated the customer account." ))
                }else{
                    log.log_status =  "Successful";
                    await Log.create(log)  
                }
                return res.status(200).json(new ApiResponse(200, updateCustomer, "customer account is activated successfully."))
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
        console.log("customer Controller :: Active customer :: error ", error?.message)
    }

})

const getCustomerInfo = asyncHandler( async (req, res) =>{
    try{

        const {email} = req.body
        //const customer = await Customer.findByField("email='"+email+"'")
        const customer = await Customer.find({'email':email},['password','activation_token'])

        if(customer){
           return res.status(201).json(new ApiResponse(200, customer, " Fetch the customer information successfully. "))
        }else{
            return new ApiError(404," Issue to fetch customer data") 
        }
    }catch(error){
        console.log(" Customer Controller :: getCustomerDetail :: error ", error?.message)
    }
})

// for forget password
const getCustomerDetail = asyncHandler( async (req, res) =>{
    try{

        const {email} = req.body
        //const customer = await Customer.findByField("email='"+email+"'")
        const customer = await Customer.find({'email':email}).execute();

        if(customer){
            const activationToken = generateRandomString(55);
            const data = {
                activation_token: activationToken
            };

            const updateCustomer= await Customer.update({'id':customer.id}, data)
            if(updateCustomer){

                const emailSend = await new Email().send(customer.email,"Reset Password", resetPasswordTempate(`http://localhost:3000/api/v1/customers/forgetPassword/${activationToken}`)) 
    
                if(emailSend){
                    return res.status(201).json(new ApiResponse(200, updateCustomer, " email send to user for reset password"))
                }
                throw new ApiError(400," Error while sending the email.")
            }else{
                throw new ApiError(400," Error while storeing token.") 
            }
        }else{
            return new ApiError(404," email address is not found. ") 
        }
    }catch(error){
        console.log(" Customer Controller :: getCustomerDetail :: error ", error?.message)
    }
})

const forgetPassword = asyncHandler( async (req, res) =>{
    try{
        
            const {token} = req.params
            const {newPassword} = req.body
 
            //const customer = await Customer.findByField(" activation_token ='" + token+"'") 
            const customer = await Customer.find({'activation_token':token}).execute(); 

            const log={
                actor_id: customer.id,
                actor_role: "customer",
                description : `${customer.company_name} password has been changed.`,
            }
             
            if(customer.activation_token == token){
                const encryptNewPassword =  await bcrypt.hash(newPassword, 10)
                const changePassword = await Customer.update({'id':customer.id}, {
                    password: encryptNewPassword, 
                    is_active:true,  
                    activation_token: null,
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
                throw new ApiError(400, "Toekn is not recognise")   
            }
    }catch(error){
        console.log('Customer Controller :: forgetPassword :: error ', error?.message )
    }

})

const listCustomer = asyncHandler( async (req, res) =>{
    try{

        const customer = await Customer.find({}, ['password','activation_token']).execute();
        if(!customer){
            return res.status(400).json(new ApiError(400, "No customer found."))
        }   
        res.status(200).json(new ApiResponse(200,customer," Customer list."))

    }catch(error){
        throw new ApiError(400, "Error in listing customer", error?.message)
    }
})

const updateCustomer = asyncHandler( async (req, res) =>{
    try{
        const {
            id,
            company_name,
            email,
            contact_person_name,
            contact_person_email,
            mobile,
            return_address,
            warranty_months,
            warranty_type,
            doa_warranty_days,
            doa_warranty_type,
            warranty_remarks,
            sales_person,
            is_pickup_faulty,
        } = req.body

        if([company_name,email,contact_person_name,return_address, warranty_type, doa_warranty_type,sales_person].some((field) => field?.trim() === "")){
            throw new ApiError(400, "All field are required")
        }
        
        const customer = await Customer.update({'id':id},{
            company_name,
            email,
            contact_person_name,
            contact_person_email,
            mobile,
            return_address,
            warranty_months,
            warranty_type,
            doa_warranty_days,
            doa_warranty_type,
            warranty_remarks,
            sales_person,
            is_pickup_faulty
        })

        if(!customer){
            return res.status(400).json(new ApiError(400, "Error while updating customer."))
        }

        const updatedCustomer = await Customer.find({id:customer},['password','activation_token']).execute();

        res.status(200).json(new ApiResponse(200,updatedCustomer," Update customer successfaully."))
        
    }catch(error){
        throw new ApiError(400, "Error in update customer", error?.message)
    }
})

const searchCustomer = asyncHandler(async(req,res)=>{
    try {
        const searchTerm = req.body

        if(!searchTerm){
            throw new ApiError(400,"seach term in empty.")
        }

        const customer = await Customer.search(searchTerm)

        if(!customer){
            throw new ApiError(400," No Customer found.")
        }
        res.status(200).json(new ApiResponse(200, customer, "customer found."))
    } catch (error) {
        throw new ApiError(400," Error in searching customer")
    }
})

const getCustomerByID = asyncHandler( async (req, res) =>{
    try{

        const {id} = req.body
        const customer = await Customer.find({'id':id},['password','activation_token']).execute();

        if(customer){
           return res.status(201).json(new ApiResponse(200, customer, " Fetch the customer information successfully. "))
        }else{
            return res.status(404).json(new ApiError(404, customer, " Issue to fetch customer data"))
        }
    }catch(error){
        return res.status(400).json(new ApiError(400,`Customer Controller :: getCustomerDetail :: error  ${error?.message}`))
    }
})

const toggleStatus = asyncHandler( async (req, res) =>{
    try {
        
        const {id} = req.query

        if(!id){
            return res.status(400).json(new ApiError(400, "All the field required"));
        }

        const customerData = await Customer.find({'id':id}).execute();

        const customer = await Customer.update({'id':id},{
            is_active: !customerData.is_active
        })

        if(!customer){
            throw new ApiError(400," Error while updating customer status.")
        }

        const log={
            actor_id: req.user.id,
            actor_role: req.user.role,
            description : `${req.user.first_name + " " + req.user.last_name} has ${customerData.is_active == 0 ? 'activated': 'deactivated'} the customer ${customerData.first_name +" "+ customerData.last_name}`,
            log_status: "Successful"
        }
        await Log.create(log)   


        res.status(200).json(new ApiResponse(200,customer,"Customer status changed successfully"))

    } catch (error) {
        throw new ApiError(400," Error while changeing the status.")
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