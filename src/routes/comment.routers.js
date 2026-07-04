import { Router } from "express";
import { verifyJWT } from "../middlewares/auth.middleware.js";
import { authorizeRoles } from "../middlewares/authorisation.middleware.js";
import { upload } from "../middlewares/multer.middleware.js";
import { uploadRateLimit } from "../middlewares/rateLimit.middleware.js";
import { 
    insertComment,
    listComment,
    updateComment
 } from "../controllers/comment.controller.js";



const router =  Router()

router.route('/list').post(verifyJWT,authorizeRoles(["ADMIN","SUPER_ADMIN","TECHNICIAN"]),listComment)
router.route('/create').post(verifyJWT,authorizeRoles(["ADMIN","SUPER_ADMIN","TECHNICIAN"]),uploadRateLimit,upload.any(),insertComment)
router.route('/update').put(verifyJWT,authorizeRoles(["ADMIN","SUPER_ADMIN","TECHNICIAN"]),updateComment)


export default router
