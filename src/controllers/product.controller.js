import {ApiError} from "../utils/ApiError.js"
import {ApiResponse} from "../utils/ApiResponse.js"
import {asyncHandler} from "../utils/asyncHandler.js"
import { ProductModel } from "../models/product.model.js"
import moment from "moment"


const Product = new ProductModel()


const insertProduct = asyncHandler(async(req,res)=>{
    try {
        const {sku,product_name,model,color,branch,status} = req.body

        if([sku,product_name,branch,].some((field)=> field?.trim() === "")){
            throw new ApiError(400, " Data is required. ")
        }

        const product = await Product.create({
            sku,
            product_name,
            model,
            color,
            branch,
            status: "Active",
            created_date : moment().format("YYYY-MM-DD HH:mm:ss"),
            updated_date : moment().format("YYYY-MM-DD HH:mm:ss")
        })
    
        if(!product){
            throw new ApiError(400,"Error while inserting the product")
        }
        res.status(200).json(new ApiResponse(200, product," Product inserted successfully."))
    } catch (error) {
        throw new ApiError(400," Error while inserting product.")
    }
})

const updateProduct = asyncHandler(async(req,res)=>{
    try {
        const {id,sku,product_name,model,color,branch,status} = req.body

        if([id,sku,product_name,model,color,branch,status].some((field)=> field?.trim() === "")){
            throw new ApiError(400, " Data is required. ")
        }

        const product = await Product.update({'id':id},{
            sku,
            product_name,
            model,
            color,
            branch,
            status,
            updated_date : moment().format("YYYY-MM-DD HH:mm:ss")
        })
    
        if(!product){
            throw new ApiError(400,"Error while updating the product")
        }
        res.status(200).json(new ApiResponse(200, product," Product updated successfully."))
    } catch (error) {
        throw new ApiError(400," Error while updateing product.")
    }
})

const listAllProduct = asyncHandler(async(req,res) => {
    try {
        
        // Get page and limit from query params, default to page 1, limit 10
        let page = parseInt(req.body.page) || 1;
        let limit = parseInt(req.body.limit) || 10;
        let offset = (page - 1) * limit;

        // call DB  
        const data = await Product.findAll(limit,offset)
            
        return res.status(200).json(new ApiResponse(200, data, "Proudct data"))

    } catch (error) {
        throw new ApiError(200, "Error while listing Product ", error?.message)
    }
})

const listProducts = asyncHandler(async(req,res) => {
    try {
        
        const data = await Product.find().execute()
        if(!data){
            return res.status(400).json(new ApiError(404," no data found"))
        }    
        return res.status(200).json(new ApiResponse(200, data, "Proudct data"))

    } catch (error) {
        throw new ApiError(200, "Error while listing Product ", error?.message)
    }
})

const searchProudct = asyncHandler(async(req,res)=>{
    try {

        const is_active = req.body.is_active || 1;
        const keyword = req.body.keyword;

         // Validation of data
         if ([is_active, keyword].some(field => !field?.trim())) {
            throw new ApiError(400, "All fields are required");
        }

        let status=''
        if(is_active == 1 ) status =" and status='public'";
        if(is_active == 0 ) status =" and status='inactive'";

        const product = await Product.findByMultipleField(keyword, status )

        if(!product){
            throw new ApiError(400, "No Product Found. ")
        }

        return res.status(200).json(new ApiResponse(200,product, "Proudct List"))

    } catch (error) {
        throw new ApiError(400,' Error in seach product')
    }
})

// TODO: Sync product with Cin7 Product Database.

export{
    listAllProduct,
    listProducts,
    insertProduct,
    updateProduct,
    searchProudct
}
