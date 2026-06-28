import {ApiError} from "../utils/ApiError.js"
import {ApiResponse} from "../utils/ApiResponse.js"
import {asyncHandler} from "../utils/asyncHandler.js"
import moment from "moment"
import bcrypt from "bcrypt"
import { Email } from "../utils/Email.js"
import {signupEmailTempate} from "../templates/signup.templates.js"
import {resetPasswordTempate} from "../templates/resetPassword.template.js"
import {generateRandomString, diffTwoDateTime} from "../utils/common.js"
import { generateAccessToken, generateRefreshToken } from "../utils/tokenHandler.js"

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

            const existingCustomer = await prisma.customer.findFirst({
                where:{
                    organizationId: Number(organizationId),
                    OR: [{ companyName }, { email }],
                }
            })

    
            if(existingCustomer){
                return res.status(400).json(new ApiError(400,"Customer with company name is already exists !!!"))
            }

            // generate the store code/ customer code
            const org = await prisma.organization.findUnique({ where:{id:Number(organizationId) }})
            if (!org) {
                return res.status(404).json(new ApiError(404,"Organization not found"))
            }
            //const last_StoreCode = await Customer.selectFields('id').orderBy('id',"DESC").limit(1).execute();
            const last_StoreCode = await prisma.customer.findFirst({
                orderBy: {id: 'DESC'},
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
                    email,
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
                    isPickupFaulty,
                    salesPerson, 
                    isActive:false,
                    isLocked:true, 
                    activationToken: activationToken,
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
                const emailSend = await new Email().send(customer.email,"RMA Service online account activation", signupEmailTempate(activationUrl(`/api/v1/customers/activecustomer/${activationToken}`))) 
                
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
                return res.status(400).json(new ApiResponse(400,"something went wrong in register the customer"))
            }

    }catch(error){
        const log={
            actorId: req.user?.id ?? 0,
            actorRole: req.user?.role ?? "SYSTEM",
            description : `${error.message}`,         
            logStatus: "Failure"
        }
        await prisma.systemLog.create({data:log})
        return res.status(400).json(new ApiResponse(400,"something went wrong in register the customer"))
    }
    
})

const loginCustomer = asyncHandler( async (req, res) =>{

    try{

        // get data from user
        const {email, password} = req.body;

        // validate data 
        if(!email || !password){
            return res.status(400).json(new ApiError(400, " email and password are required"))
        }

        // check user in db
        //const customer = await Customer.findByField("email ='" + email+"'")
        //const customer = await Customer.find({'email':email}).execute();
        const customer = await prisma.customer.findFirst({ where:{ email }})

        if(!customer){
            return res.status(400).json(new ApiError(400,"please enter correct email address."))
        }

        const log={
            actorId: customer.id,
            actorRole: "customer", 
            description : `${customer.companyName} login into the system.`
        }


        // password check
        const isPasswordValid = await bcrypt.compare(password,customer.password)
        if(!isPasswordValid){
            log.logStatus =  "Faliure";
            await prisma.systemLog.create({data:log})
            return res.status(401).json(new ApiError(401, "password is not valid "))
        }

        // generae Accesstoken & refToken
        //const {accessToken, refreshToken} = await generateAccessAndRefereshToken(customer)
        const accessToken = await generateAccessToken(customer)
        const refreshToken = await generateRefreshToken(customer)

        // send cookies
        //const loggedInUser= await User.findById(user.id)
        //const loggedInCustomer = await Customer.find({id:customer.id},['password','activation_token']).execute();
        const loggedInCustomer = await prisma.customer.findUnique({
            where:{id:customer.id},
            select: publicCustomerSelect,
        })


        if(!loggedInCustomer){
            return res.status(400).json(new ApiError(400,"Customer not found...."))
        }

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
                    user: loggedInCustomer, accessToken, refreshToken
                },
                "Customer login successfully"
            )
        )
    }catch(error){
        console.log(" Customer Controller :: Login Customer :: error ", error?.message)
        return res.status(400).json(new ApiError(400, `something went wrong in login the user`, error?.message))
    }

})

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

        return res
        .status(200)
        .clearCookie("accessToken",options)
        .clearCookie("refreshToken",options)
        .json(
            new ApiResponse(200,{}, "Customer Logged out")
        )

    }catch(error){
        console.log("Customer COntroller :: Logout :: error ", error?.message)
        return res.status(400).json(new ApiError(400, "something went wrong in logout the customer", error?.message))
    }

})

const changeCurrentPassword = asyncHandler( async (req, res) =>{

    try{
        const {oldPassword, newPassword} = req.body

        if(!oldPassword || !newPassword){
            return res.status(400).json(new ApiError(400, "passwords are required"))
        }

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
        
        log.logStatus =  "Successful";
        await prisma.systemLog.create({data:log})

        return res
        .status(200)
        .json(new ApiResponse(200, changepassword , "Password Changed Successfully"))
    }catch(error){
        console.log("Customer Controller :: Changerpassword :: error", error?.message)
        return res.status(400).json(new ApiError(400, "something went wrong in change password for customer", error?.message))
    }
})

const activeCustomer = asyncHandler( async (req, res) =>{

    try{
        const {token} = req.params

        //const customer = await Customer.find({'activation_token':token}).execute();
        const customer =await prisma.customer.findFirst({
            where:{activationToken:token}
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
            activationToken:null
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
        console.log("customer Controller :: Active customer :: error ", error?.message)
        return res.status(400).json(new ApiError(400, "something went wrong in active customer", error?.message))
    }

})

const getCustomerInfo = asyncHandler( async (req, res) =>{
    try{

        const {email} = req.body

        if(!email){
            return res.status(400).json(new ApiError(400," email is required."))
        }

        //const customer = await Customer.findByField("email='"+email+"'")
        //const customer = await Customer.find({'email':email},['password','activation_token'])
        const customer = await prisma.customer.findFirst({
            where:{email},
            select: publicCustomerSelect,
        })

        if(customer){
           return res.status(201).json(new ApiResponse(200, customer, " Fetch the customer information successfully. "))
        }else{
            return res.status(404).json(new ApiError(404," Issue to fetch customer data"))
        }
    }catch(error){
        console.log(" Customer Controller :: getCustomerDetail :: error ", error?.message)
        return res.status(400).json(new ApiError(400, "something went wrong in getting customer info.", error?.message))
    }
})

// for forget password
const getCustomerDetail = asyncHandler( async (req, res) =>{
    try{

        const {email} = req.body
        if(!email){
            return res.status(400).json(new ApiError(400," email is required."))
        }

        //const customer = await Customer.findByField("email='"+email+"'")
        //const customer = await Customer.find({'email':email}).execute();
        const customer = await prisma.customer.findFirst({
            where:{email},
            select: publicCustomerSelect,
        })

        if(customer){
            const passwordResetToken = generateRandomString(55);
            const data = {
                 isLocked: true,
                passwordResetToken: passwordResetToken,
                passwordResetExpires: new Date(Date.now() + 30 * 60 * 1000)

            };

            const updateCustomer= await prisma.customer.update({
                where:{id:customer.id},
                data:data,
                select: publicCustomerSelect,
            })

            if(updateCustomer){

                const emailSend = await new Email().send(customer.email,"Reset Password", resetPasswordTempate(activationUrl(`/api/v1/customers/forgetPassword/${passwordResetToken}`))) 
    
                if(emailSend){
                    return res.status(201).json(new ApiResponse(200, updateCustomer, " email send to user for reset password"))
                }
                throw new ApiError(400," Error while sending the email.")
            }else{
                throw new ApiError(400," Error while storeing token.") 
            }
        }else{
            return res.status(404).json(new ApiError(404," email address is not found. "))
        }
    }catch(error){
        console.log(" Customer Controller :: getCustomerDetail :: error ", error?.message)
        return res.status(400).json(new ApiError(400, "something went wrong in getting customer detail.", error?.message))
    }
})

const forgetPassword = asyncHandler( async (req, res) =>{
    try{
        
            const {token} = req.params
            const {newPassword} = req.body

            if((!token) && (!newPassword)){
                return res.status(500).json(new ApiError(400, " password is required."))
            }
 
            //const customer = await Customer.findByField(" activation_token ='" + token+"'") 
            //const customer = await Customer.find({'activation_token':token}).execute(); 
            const customer = await prisma.customer.findFirst({
                where:{passwordResetToken:token},
            })

            if (!customer) {
                return res.status(400).json(new ApiError(400, "Token is not recognised"))
            }

            const log={
                actorId: customer.id,
                actorRole: "customer",
                description : `${customer.companyName} password has been changed.`,
            }

            if(customer.passwordResetToken == token && (!customer.passwordResetExpires || customer.passwordResetExpires > new Date())){
                const encryptNewPassword =  await bcrypt.hash(newPassword, 10)
                const changePassword = await prisma.customer.update({
                    where: {id:customer.id},
                    data: {
                        password: encryptNewPassword,
                        isLocked:false,
                        passwordResetToken: null,
                        passwordResetExpires:null
                    },
                    select: publicCustomerSelect,
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
                throw new ApiError(400, "Toekn is not recognise")   
            }
    }catch(error){
        console.log('Customer Controller :: forgetPassword :: error ', error?.message )
        return res.status(400).json(new ApiError(400, "something went wrong in forgot customer password.", error?.message))
    }

})

const listCustomer = asyncHandler( async (req, res) =>{
    try{

        //const customer = await Customer.find({}, ['password','activation_token']).execute();
        const customer = await prisma.customer.findMany({
            select: publicCustomerSelect,
        })
        if(!customer){
            return res.status(400).json(new ApiError(400, "No customer found."))
        }   
        res.status(200).json(new ApiResponse(200,customer," Customer list."))

    }catch(error){
        throw new ApiError(400, "Error in listing customer", error?.message)
        return res.status(400).json(new ApiError(400, "something went wrong in listing customers.", error?.message))
    }
})

const updateCustomer = asyncHandler( async (req, res) =>{
    try{
        const {
            id,
            companyName,
            email,
            contactPersonName,
            contactPersonEmail,
            mobile,
            returnAddress,
            warrantyMonths,
            warrantyType,
            doaArrantyDays,
            doaWarrantyType,
            warrantyRemarks,
            salesPerson,
            isPickupFaulty
        } = req.body

        if([companyName,email,contactPersonName,contactPersonEmail,returnAddress,warrantyMonths, warrantyType, doaArrantyDays,doaWarrantyType,warrantyRemarks,salesPerson].some((field) => field?.trim() === "")){
            throw new ApiError(400, "All field are required")
        }
        
        const customer = await prisma.customer.update({
            where:{id:Number(id)},
            data:{
                companyName,
                email,
                contactPersonName,
                contactPersonEmail,
                mobile,
                returnAddress,
                warrantyMonths,
                warrantyTypes: warrantyType,
                doaWarrantyDays: Number(doaArrantyDays),
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

        res.status(200).json(new ApiResponse(200,customer," Update customer successfaully."))
        
    }catch(error){
        throw new ApiError(400, "Error in update customer", error?.message)
        return res.status(400).json(new ApiError(400, "something went wrong in update customer.", error?.message))
    }
})

const searchCustomer = asyncHandler(async(req,res)=>{
    try {
        const { searchTerm } = req.body

        if(!searchTerm){
            throw new ApiError(400,"seach term in empty.")
        }

        const customer = await prisma.customer.findMany({
            where: {
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
        if(!id){
            return res.status(400).json(new ApiError(400,'customer id is requied.'))
        }

        const customer = await prisma.customer.findUnique({
            where:{id:Number(id)},
            select: publicCustomerSelect,
        })

        if(customer){
           return res.status(200).json(new ApiResponse(200, customer, " Fetch the customer information successfully. "))
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

        const customerData = await prisma.customer.findUnique({
            where:{id:Number(id)},
            select: publicCustomerSelect,
        })

        if(!customerData){
            return res.status(404).json(new ApiError(404,"Customer not found."))
        }

        const customer = await prisma.customer.update({
            where: {id:Number(id)},
            data: {isActive: !customerData.isActive},
            select: publicCustomerSelect,
        })

        if(!customer){
            throw new ApiError(400," Error while updating customer status.")
        }

        const log={
            actorId: req.user.id,
            actorRole: req.user.role,
            description : `${req.user.firstName} ${req.user.lastName} has ${customerData.isActive ? 'deactivated': 'activated'} the customer ${customerData.companyName}`,
            logStatus: "Successful"
        }
        await prisma.systemLog.create({data:log})   

        res.status(200).json(new ApiResponse(200,customer,"Customer status changed successfully"))

    } catch (error) {
        res.status(400).json(new ApiError(400," Error while changeing the status."))
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
