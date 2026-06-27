import { Router } from "express";
import { verifyJWT } from "../middlewares/auth.middleware.js";
import { authorizeRoles } from "../middlewares/authorisation.middleware.js";
import { upload } from "../middlewares/multer.middleware.js";
import { 
    insertComment,
    listComment,
    updateComment
 } from "../controllers/comment.controller.js";



const router =  Router()

router.route('/list').post(verifyJWT,authorizeRoles(["ADMIN","SUPER_ADMIN","CUSTOMER"]),listComment)
router.route('/create').post(verifyJWT,authorizeRoles(["ADMIN","SUPER_ADMIN","CUSTOMER"]),upload.any(),insertComment)
router.route('/update').put(verifyJWT,authorizeRoles(["ADMIN","SUPER_ADMIN","CUSTOMER"]),updateComment)


export default router