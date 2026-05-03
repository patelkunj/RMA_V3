import { Router } from "express";
import { verfiyJWT } from "../middlewares/auth.middleware.js";
import {authorizeRoles} from "../middlewares/authorisation.middleware.js"
import{ 
    insertSerialNumber,
    listSerialNumber,
    updateSerialNumber,
    uploadSerialNumber
} from "../controllers/serialnumber.controller.js";


const router = Router()

// verfiyJWT is middleware
//Secure routes
router.route("/").get(verfiyJWT, authorizeRoles(["Admin","Super Admin"]),listSerialNumber);
router.route("/").put(verfiyJWT,authorizeRoles(["Admin","Super Admin"]),updateSerialNumber);
router.route("/").post(verfiyJWT,authorizeRoles(["Admin","Super Admin"]),insertSerialNumber);
router.route("/upload_serialnumber").post(verfiyJWT,authorizeRoles(["Admin","Super Admin"]),uploadSerialNumber);


export default router;





