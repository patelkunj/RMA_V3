import { Router } from "express";
import { verifyJWT } from "../middlewares/auth.middleware.js";
import {authorizeRoles} from "../middlewares/authorisation.middleware.js"
import { upload } from "../middlewares/multer.middleware.js";
import { uploadRateLimit } from "../middlewares/rateLimit.middleware.js";
import{ 
    insertSerialNumber,
    listSerialNumber,
    updateSerialNumber,
    uploadSerialNumber
} from "../controllers/serialnumber.controller.js";


const router = Router()

// verfiyJWT is middleware
//Secure routes
router.route("/").get(verifyJWT, authorizeRoles(["ADMIN","SUPER_ADMIN"]),listSerialNumber);
router.route("/").put(verifyJWT,authorizeRoles(["ADMIN","SUPER_ADMIN"]),updateSerialNumber);
router.route("/").post(verifyJWT,authorizeRoles(["ADMIN","SUPER_ADMIN"]),insertSerialNumber);
router.route("/upload_serialnumber").post(verifyJWT,authorizeRoles(["ADMIN","SUPER_ADMIN"]),uploadRateLimit,upload.single("file"),uploadSerialNumber);


export default router;



