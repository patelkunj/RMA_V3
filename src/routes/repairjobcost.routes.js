import { Router } from "express";
import { verfiyJWT } from "../middlewares/auth.middleware.js";
import {authorizeRoles} from "../middlewares/authorisation.middleware.js"
import { 
        list, 
        addRepairCost,
        updateRepairCost
 
} from "../controllers/repairjobcosting.controller.js";

const router = Router()

//Authorised Routes
router.route("/list").post(verfiyJWT,authorizeRoles(["Admin","Super Admin"]),list)
router.route("/add").post(verfiyJWT,authorizeRoles(["Admin","Super Admin"]),addRepairCost)
router.route("/update").put(verfiyJWT,authorizeRoles(["Admin","Super Admin"]),updateRepairCost)



export default router