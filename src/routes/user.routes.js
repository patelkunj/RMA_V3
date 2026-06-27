import { Router } from "express";
import { verifyJWT } from "../middlewares/auth.middleware.js";
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
router.route("/logout").post(verifyJWT,logoutUser)
router.route("/change_password").post(verifyJWT,authorizeRoles(["ADMIN","SUPER_ADMIN","TECHNICIAN"]),changeCurrentPassword)

//Authorised Routes
//router.route("/register").post(verfiyJWT, authorizeRoles(["ADMIN","Super Admin"]),registerUser)
router.route("/list_user").post(verifyJWT,authorizeRoles(["ADMIN","SUPER_ADMIN"]),listUser)
router.route("/user").post(verifyJWT,authorizeRoles(["ADMIN","SUPER_ADMIN"]),getUserById)
router.route("/update_user").put(verifyJWT,authorizeRoles(["ADMIN","SUPER_ADMIN"]),updateUser)
//router.route("/search").post(verfiyJWT,authorizeRoles(["ADMIN","SUPER_ADMIN"]),searchUser)
router.route("/toggle").put(verifyJWT,authorizeRoles(["ADMIN","SUPER_ADMIN"]),toggleStatus)

export default router