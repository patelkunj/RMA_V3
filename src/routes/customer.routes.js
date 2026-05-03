import { Router } from "express";
import { verfiyJWT } from "../middlewares/auth.middleware.js";
import {authorizeRoles} from "../middlewares/authorisation.middleware.js"
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

router.route("/login").post(loginCustomer)
router.route("/activecustomer/:token").get(activeCustomer)
router.route("/getCustomerDetail").post(getCustomerDetail)
router.route("/forgetPassword/:token").post(forgetPassword)
router.route("/customerinfo").post(getCustomerInfo)

//Secure routes
router.route("/logout").post(verfiyJWT,authorizeRoles(["Customer"]),logoutCustomer)
router.route("/change_password").post(verfiyJWT,authorizeRoles(["Customer"]),changeCurrentPassword)

// Authorized routes
router.route("/register").post(verfiyJWT,authorizeRoles(["Admin","Super Admin"]),registerCustomer)
router.route("/search").post(verfiyJWT,authorizeRoles(["Admin","Super Admin"]),searchCustomer)
router.route("/list").post(verfiyJWT,authorizeRoles(["Admin","Super Admin"]), listCustomer)
router.route("/update").put(verfiyJWT,authorizeRoles(["Admin","Super Admin"]),updateCustomer)
router.route("/find").post(verfiyJWT,authorizeRoles(["Admin","Super Admin"]),getCustomerByID)
router.route("/activate_deactivate").put(verfiyJWT,authorizeRoles(["Admin","Super Admin"]),toggleStatus)
export default router