import { Router } from "express";
import { verfiyJWT } from "../middlewares/auth.middleware.js";
import {authorizeRoles} from "../middlewares/authorisation.middleware.js"
import {loginUser,
        registerUser, 
        logoutUser, 
        changeCurrentPassword,
        activeuser,
        getUserDetail, 
        forgetPassword,
        listUser,
        getUserById,
        updateUser,
        searchUser,
        toggleStatus
    } from "../controllers/user.controller.js"




const router = Router()


router.route("/login").post(loginUser)
router.route("/activeuser/:token").get(activeuser)
router.route("/getUserDetail").post(getUserDetail)
router.route("/forgetPassword/:token").post(forgetPassword)

router.route("/register").post(registerUser)

//Secure routes
router.route("/logout").post(verfiyJWT,logoutUser)
router.route("/change_password").post(verfiyJWT,changeCurrentPassword)

//Authorised Routes
//router.route("/register").post(verfiyJWT, authorizeRoles(["Admin","Super Admin"]),registerUser)
router.route("/list_user").post(verfiyJWT,authorizeRoles(["Admin","Super Admin"]),listUser)
router.route("/user").post(verfiyJWT,authorizeRoles(["Admin","Super Admin"]),getUserById)
router.route("/update_user").put(verfiyJWT,authorizeRoles(["Admin","Super Admin"]),updateUser)
router.route("/search").post(verfiyJWT,authorizeRoles(["Admin","Super Admin"]),searchUser)
router.route("/toggle").put(verfiyJWT,authorizeRoles(["Admin","Super Admin"]),toggleStatus)

export default router