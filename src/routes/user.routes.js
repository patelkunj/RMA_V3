import { Router } from "express";
import { verfiyJWT } from "../middlewares/auth.middleware.js";
import {authorizeRoles} from "../middlewares/authorisation.middleware.js"
import {loginUser,
        registerUser, 
        logoutUser, 
        changeCurrentPassword,
        activeUser,
        getUserDetail, 
        forgetPassword,
        listUser,
        getUserById,
        updateUser,
        //searchUser,
        toggleStatus
    } from "../controllers/user.controller.js"




const router = Router()


router.route("/login").post(loginUser)
router.route("/activeuser/:token").get(activeUser)
router.route("/getUserDetail").post(getUserDetail)
router.route("/forgetPassword/:token").post(forgetPassword)

router.route("/register").post(registerUser)

//Secure routes
router.route("/logout").post(verfiyJWT,logoutUser)
router.route("/change_password").post(verfiyJWT,changeCurrentPassword)

//Authorised Routes
//router.route("/register").post(verfiyJWT, authorizeRoles(["ADMIN","Super Admin"]),registerUser)
router.route("/list_user").post(verfiyJWT,authorizeRoles(["ADMIN","SUPER_ADMIN"]),listUser)
router.route("/user").post(verfiyJWT,authorizeRoles(["ADMIN","SUPER_ADMIN"]),getUserById)
router.route("/update_user").put(verfiyJWT,authorizeRoles(["ADMIN","SUPER_ADMIN"]),updateUser)
//router.route("/search").post(verfiyJWT,authorizeRoles(["ADMIN","SUPER_ADMIN"]),searchUser)
router.route("/toggle").put(verfiyJWT,authorizeRoles(["ADMIN","SUPER_ADMIN"]),toggleStatus)

export default router