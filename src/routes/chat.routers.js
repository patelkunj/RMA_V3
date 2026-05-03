import { Router } from "express";
import { verfiyJWT } from "../middlewares/auth.middleware.js";
import { authorizeRoles } from "../middlewares/authorisation.middleware.js";
import { upload } from "../middlewares/multer.middleware.js";
import {
    insertChat,
    listChat,
    toggleRead,
    unreadCount
} from "../controllers/chats.controller.js"



const router =  Router()

router.route('/list').post(verfiyJWT,authorizeRoles(["Admin","Customer","SuperAdmin"]),listChat)
router.route('/create').post(verfiyJWT,authorizeRoles(["Admin","Customer","SuperAdmin"]),upload.any(),insertChat)
router.route('/toggle-read').put(verfiyJWT,authorizeRoles(["Admin","Customer","SuperAdmin"]),toggleRead)
router.route('/unread-count').post(verfiyJWT,authorizeRoles(["Admin","Customer","SuperAdmin"]),unreadCount) 


export default router