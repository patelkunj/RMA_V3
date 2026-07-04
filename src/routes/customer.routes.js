import { Router } from "express";
import { verifyJWT } from "../middlewares/auth.middleware.js";
import {authorizeRoles} from "../middlewares/authorisation.middleware.js"
import { authRateLimit } from "../middlewares/rateLimit.middleware.js";
import {registerCustomer, 
        loginCustomer, 
        logoutCustomer, 
        changeCurrentPassword, 
        activeCustomer,
        getCustomerDetail,
        forgetPassword,
        getCustomerInfo,
        updateCustomer,
        searchCustomer,
        listCustomer,
        getCustomerByID,
        toggleStatus
    } from "../controllers/customer.controller.js"

const router = Router()

router.route("/login").post(authRateLimit,loginCustomer)
router.route("/activecustomer/:token").get(authRateLimit,activeCustomer)
router.route("/getCustomerDetail").post(authRateLimit,getCustomerDetail)
router.route("/forgetPassword/:token").post(authRateLimit,forgetPassword)
router.route("/customerinfo").post(verifyJWT,authorizeRoles(["ADMIN","SUPER_ADMIN"]),getCustomerInfo)

//Secure routes
router.route("/logout").post(verifyJWT,authorizeRoles(["CUSTOMER"]),logoutCustomer)
router.route("/change_password").post(verifyJWT,authorizeRoles(["CUSTOMER"]),changeCurrentPassword)

// Authorized routes
router.route("/register").post(verifyJWT,authorizeRoles(["ADMIN","SUPER_ADMIN"]),registerCustomer)
router.route("/search").post(verifyJWT,authorizeRoles(["ADMIN","SUPER_ADMIN"]),searchCustomer)
router.route("/list").post(verifyJWT,authorizeRoles(["ADMIN","SUPER_ADMIN"]), listCustomer)
router.route("/update").put(verifyJWT,authorizeRoles(["ADMIN","SUPER_ADMIN"]),updateCustomer)
router.route("/find").post(verifyJWT,authorizeRoles(["ADMIN","SUPER_ADMIN"]),getCustomerByID)
router.route("/activate_deactivate").put(verifyJWT,authorizeRoles(["ADMIN","SUPER_ADMIN"]),toggleStatus)
export default router
