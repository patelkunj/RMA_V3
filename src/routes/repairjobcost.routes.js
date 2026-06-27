import { Router } from "express";
import { verifyJWT } from "../middlewares/auth.middleware.js";
import {authorizeRoles} from "../middlewares/authorisation.middleware.js"
import { 
        list, 
        addRepairCost,
        updateRepairCost
 
} from "../controllers/repairjobcosting.controller.js";

const router = Router()

//Authorised Routes
router.route("/list").post(verifyJWT,authorizeRoles(["ADMIN","SUPER_ADMIN","TECHNICIAN"]),list)
router.route("/add").post(verifyJWT,authorizeRoles(["ADMIN","SUPER_ADMIN","TECHNICIAN"]),addRepairCost)
router.route("/update").put(verifyJWT,authorizeRoles(["ADMIN","SUPER_ADMIN","TECHNICIAN"]),updateRepairCost)



export default router