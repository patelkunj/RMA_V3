import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";
//import { OrganizationModel } from "../models/organization.model.js";
import moment from "moment";
import prisma from "../db/prisma.js";


// const Organization = new OrganizationModel(); 

// const Organization = new OrganizationModel();

// add pagination
const listOrganization = asyncHandler(async (req, res) => {
    const org = await prisma.organization.findMany();

    return res.status(200).json(
        new ApiResponse(200, org, "List of all organizations")
    );
});


// const listOrganization = asyncHandler( async (req, res) =>{
//     try{
//         const org = await Organization.find().execute();

//         if(!org){
//             res.status(404).json(new ApiError(404, "No organization found"))
//         }        
//         res.status(200).json(new ApiResponse(200,org, "List of all organization"))

//     }catch(error){
//         throw new ApiError(400, "Error while listing organization. ")
//     }
// })


const creatOrganization = asyncHandler(async (req, res) => {
    const { name, alias, address, email, phone, is_active } = req.body;

    if (!name || !alias) {
        throw new ApiError(400, "Name and alias are required");
    }

    const org = await prisma.organization.create({
        data: {
            name,
            alias,
            address,
            email,
            phone,
            is_active: is_active ?? false,
        }
    });

    return res.status(201).json(
        new ApiResponse(201, org, "Organization created successfully")
    );
});

// const creatOrganization = asyncHandler( async (req, res) =>{
//     try {

//         const {name, alias, address, email, phone, is_active} = req.body

//         if([name, alias, address, email, phone].some((field) => field?.trim() === "")){
//             throw new ApiError(400, "All field are required")
//         }

//         const org = await Organization.create({
//             name, 
//             alias, 
//             address,
//             email,
//             phone,
//             is_active,
//             created_date : moment().format("YYYY-MM-DD HH:mm:ss"),
//             updated_date : moment().format("YYYY-MM-DD HH:mm:ss")
//         })

//         if(!org){
//             return res.status(400).json(new ApiError(400, "Error while inserting organizaiton."))
//         }

//         return res.status(200).json(new ApiResponse(200, org, "Organization created successfully."))

//     } catch (error) {
//         throw new ApiError(400, "Error while creating organization. " )
//     }
// });

const updateOrganization = asyncHandler(async (req, res) => {
    const { id, name, alias, address, email, phone, is_active } = req.body;

    if (!id) {
        throw new ApiError(400, "ID is required");
    }

    const org = await prisma.organization.update({
        where: { id: Number(id) },
        data: {
            name,
            alias,
            address,
            email,
            phone,
            is_active,
        }
    });

    return res.status(200).json(
        new ApiResponse(200, org, "Organization updated successfully")
    );
});


// const updateOrganization = asyncHandler( async (req, res) =>{
//     try {
        
//         const {id, name, alias, address, email, phone, is_active} = req.body

//         if([name, alias, address, email].some((field) => field?.trim() === "")){
//             throw new ApiError(400, "All field are required")
//         }

//         const org = await Organization.update({'id':id},{
//             name, 
//             alias, 
//             address,
//             email,
//             phone,
//             is_active,
//             updated_date : moment().format("YYYY-MM-DD HH:mm:ss")
//         })

//         if(!org){
//             return res.status(400).json(new ApiError(400, " Error while inserting organizaiton."))
//         }

//         return res.status(201).json(new ApiResponse(200, org, " Organization updated successfully."))

//     } catch (error) {
//         throw new ApiError(400, "Error while updating organization. " )
//     }
// });


const toggleStatus = asyncHandler(async (req, res) => {
    const { id, is_active } = req.body;

    if (!id) {
        throw new ApiError(400, "ID is required");
    }

    const org = await prisma.organization.update({
        where: { id: Number(id) },
        data: {
            is_active,
        }
    });

    return res.status(200).json(
        new ApiResponse(200, org, "Status updated successfully")
    );
});

// const toggleStatus = asyncHandler( async (req, res) =>{
//     try {
        
//         const {id,is_active} = req.body

//         if([id].some((field) => field?.trim() === "")){
//             throw new ApiError(400, "All field are required")
//         }

//         const org = await Organization.update({'id':id},{
//             is_active,
//             updated_date : moment().format("YYYY-MM-DD hh:mm:ss")
//         })

//         if(!org){
//             return res.status(400).json(new ApiError(400, " Error while change the status"))
//         }

//         return res.status(201).json(new ApiResponse(200, org, " Organization updated successfully."))

//     } catch (error) {
//         throw new ApiError(400, "Error while changing status of organization. " )
//     }
// });

// const searchCompany = asyncHandler(async(req,res)=>{
//     try {
//         const searchTerm = req.body

//         if(!searchTerm){
//             throw new ApiError(400, " search in empty.")
//         }

//         const org = await Organization.search(searchTerm)

//         if(!org){
//             res.status(404).json(new ApiResponse(404, null, " No company found"))
//         }

//         res.status(200).json(new ApiResponse(200, org, " company found"))

//     } catch (error) {
//         throw new ApiError(400, " Error in seach company")
//     }
// })


// const allCompany = asyncHandler(async(req,res)=>{
//     try {
//         const org = await Organization.find()
//         if(!org){
//             res.status(404).json(new ApiResponse(404, null, " No company found"))
//         }
//         res.status(200).json(new ApiResponse(200, org, " company found"))
        
//     } catch (error) {
//         throw new ApiError(400," Error in all company list")   
//     }
// })

export {
    listOrganization,
    creatOrganization,
    updateOrganization,
    toggleStatus,
    // searchCompany,
    // allCompany
}