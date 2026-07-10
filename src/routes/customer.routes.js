import { Router } from "express";
import { verifyJWT } from "../middlewares/auth.middleware.js";
import { authorizeRoles } from "../middlewares/authorisation.middleware.js";
import { authRateLimit } from "../middlewares/rateLimit.middleware.js";
import {
    activeCustomer,
    changeCurrentPassword,
    forgetPassword,
    getCustomerByID,
    getCustomerDetail,
    getCustomerInfo,
    listCustomer,
    loginCustomer,
    logoutCustomer,
    registerCustomer,
    searchCustomer,
    toggleStatus,
    updateCustomer,
} from "../controllers/customer.controller.js";

const router = Router();
const ADMIN_ROLES = ["ADMIN", "SUPER_ADMIN"];

router.post("/login", authRateLimit, loginCustomer);
router.get("/activecustomer/:token", authRateLimit, activeCustomer);
router.post("/getCustomerDetail", authRateLimit, getCustomerDetail);
router.post("/forgetPassword/:token", authRateLimit, forgetPassword);

router.use(verifyJWT);

router.post("/logout", authorizeRoles(["CUSTOMER"]), logoutCustomer);
router.post("/change_password", authorizeRoles(["CUSTOMER"]), changeCurrentPassword);

router.post("/customerinfo", authorizeRoles(ADMIN_ROLES), getCustomerInfo);
router.post("/register", authorizeRoles(ADMIN_ROLES), registerCustomer);
router.post("/search", authorizeRoles(ADMIN_ROLES), searchCustomer);
router.post("/list", authorizeRoles(ADMIN_ROLES), listCustomer);
router.put("/update", authorizeRoles(ADMIN_ROLES), updateCustomer);
router.post("/find", authorizeRoles(ADMIN_ROLES), getCustomerByID);
router.put("/activate_deactivate", authorizeRoles(ADMIN_ROLES), toggleStatus);

router.route("/")
    .get(authorizeRoles(ADMIN_ROLES), listCustomer)
    .post(authorizeRoles(ADMIN_ROLES), registerCustomer)
    .put(authorizeRoles(ADMIN_ROLES), updateCustomer);
router.patch("/status", authorizeRoles(ADMIN_ROLES), toggleStatus);

export default router;
