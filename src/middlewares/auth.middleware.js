//import {UserModel} from "../models/user.model.js";
import { CustomerModel } from "../models/customer.model.js";
import {ApiError}  from "../utils/ApiError.js";
import {asyncHandler} from "../utils/asyncHandler.js";
import jwt from "jsonwebtoken"
import prisma from "../db/prisma.js";




export const verfiyJWT = asyncHandler(async(req, res, next)=>{
     try {
        //const token = || req.header("Authorization")?.replace("Bearer ", "")
         const token = req.cookies?.accessToken || req.headers['authorization']?.replace("Bearer ", "")
        if(!token){
           return res.status(401).json(new ApiError(401, "Unauthorized request"))
        }
   
       const decodeedToken= jwt.verify(token, process.env.ACCESS_TOKEN_SECRET)
   
       //const User = new UserModel();
       //const user = await User.find({'id': decodeedToken?.id,'email':decodeedToken?.email}).execute();

       const user = await prisma.User.findUnique({
         where:{id: decodeedToken?.id,email:decodeedToken?.email}
       })
   
       if(!user){

         const Customer = new CustomerModel();
         const customer = await Customer.find({'id':decodeedToken?.id, 'email':decodeedToken?.email}).execute();

         if(!customer){
            return res.status(401).json(new ApiError(401, "Invalid Access Token"))
         }

         req.customer = customer
         //next()  --> Reason why i got error " Can't set headers after they are sent "
       }
       req.user = user
       next()
     } catch (error) {
        return res.status(401).json(new ApiError(401, error?.message || " issue in verityJWT middileware"))
     }
    
})