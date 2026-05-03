import { Router } from "express";
import { verfiyJWT } from "../middlewares/auth.middleware.js";
import { authorizeRoles } from "../middlewares/authorisation.middleware.js";
import { upload } from "../middlewares/multer.middleware.js";
import { 
    insertComment,
    listComment,
    updateComment
 } from "../controllers/comment.controller.js";



const router =  Router()

router.route('/list').post(verfiyJWT,authorizeRoles(["Admin","Customer","SuperAdmin"]),listComment)
router.route('/create').post(verfiyJWT,authorizeRoles(["Admin","Customer","SuperAdmin"]),upload.any(),insertComment)
router.route('/update').put(verfiyJWT,authorizeRoles(["Admin","Customer","SuperAdmin"]),updateComment)


export default router