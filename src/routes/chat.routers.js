import { Router } from "express";
import { verifyJWT } from "../middlewares/auth.middleware.js";
import { authorizeRoles } from "../middlewares/authorisation.middleware.js";
import { upload } from "../middlewares/multer.middleware.js";
import { uploadRateLimit } from "../middlewares/rateLimit.middleware.js";
import {
    insertChat,
    listChat,
    toggleRead,
    unreadCount
} from "../controllers/chats.controller.js"



const router =  Router()

router.route('/list').post(verifyJWT,authorizeRoles(["ADMIN","SUPER_ADMIN","CUSTOMER"]),listChat)
router.route('/create').post(verifyJWT,authorizeRoles(["ADMIN","SUPER_ADMIN","CUSTOMER"]),uploadRateLimit,upload.any(),insertChat)
router.route('/toggle-read').put(verifyJWT,authorizeRoles(["ADMIN","SUPER_ADMIN","CUSTOMER"]),toggleRead)
router.route('/unread-count').post(verifyJWT,authorizeRoles(["ADMIN","SUPER_ADMIN","CUSTOMER"]),unreadCount) 


export default router
