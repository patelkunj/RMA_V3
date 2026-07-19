import { Router } from "express";
import { verifyJWT } from "../middlewares/auth.middleware.js";
import { authorizeRoles } from "../middlewares/authorisation.middleware.js";
import { authRateLimit } from "../middlewares/rateLimit.middleware.js";
import { deprecateRoute } from "../middlewares/deprecation.middleware.js";
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
router.get("/activate/:token", authRateLimit, activeCustomer);
router.post("/password-reset/request", authRateLimit, getCustomerDetail);
router.post("/password-reset/:token", authRateLimit, forgetPassword);

router.get(
    "/activecustomer/:token",
    deprecateRoute((req) => `/api/v1/customers/activate/${req.params.token}`),
    authRateLimit,
    activeCustomer,
);
router.post(
    "/getCustomerDetail",
    deprecateRoute("/api/v1/customers/password-reset/request"),
    authRateLimit,
    getCustomerDetail,
);
router.post(
    "/forgetPassword/:token",
    deprecateRoute((req) => `/api/v1/customers/password-reset/${req.params.token}`),
    authRateLimit,
    forgetPassword,
);

router.use(verifyJWT);

router.post("/logout", authorizeRoles(["CUSTOMER"]), logoutCustomer);
router.patch("/password", authorizeRoles(["CUSTOMER"]), changeCurrentPassword);

router.post(
    "/change_password",
    deprecateRoute("/api/v1/customers/password"),
    authorizeRoles(["CUSTOMER"]),
    changeCurrentPassword,
);

router.get("/search", authorizeRoles(ADMIN_ROLES), searchCustomer);
router.get("/by-email", authorizeRoles(ADMIN_ROLES), getCustomerInfo);

router.post("/customerinfo", deprecateRoute((req) => {
    const email = req.body?.email ? `?email=${encodeURIComponent(req.body.email)}` : "";
    return `/api/v1/customers/by-email${email}`;
}), authorizeRoles(ADMIN_ROLES), getCustomerInfo);
router.post("/register", deprecateRoute("/api/v1/customers"), authorizeRoles(ADMIN_ROLES), registerCustomer);
router.post("/search", deprecateRoute((req) => {
    const searchTerm = req.body?.searchTerm ? `?searchTerm=${encodeURIComponent(req.body.searchTerm)}` : "";
    return `/api/v1/customers/search${searchTerm}`;
}), authorizeRoles(ADMIN_ROLES), searchCustomer);
router.post("/list", deprecateRoute("/api/v1/customers"), authorizeRoles(ADMIN_ROLES), listCustomer);
router.put("/update", deprecateRoute((req) => `/api/v1/customers/${req.body?.id || "{id}"}`), authorizeRoles(ADMIN_ROLES), updateCustomer);
router.post("/find", deprecateRoute((req) => `/api/v1/customers/${req.body?.id || "{id}"}`), authorizeRoles(ADMIN_ROLES), getCustomerByID);
router.put("/activate_deactivate", deprecateRoute((req) => `/api/v1/customers/${req.body?.id || req.query.id || "{id}"}/status`), authorizeRoles(ADMIN_ROLES), toggleStatus);

router.route("/")
    .get(authorizeRoles(ADMIN_ROLES), listCustomer)
    .post(authorizeRoles(ADMIN_ROLES), registerCustomer);
router.put("/", deprecateRoute((req) => `/api/v1/customers/${req.body?.id || "{id}"}`), authorizeRoles(ADMIN_ROLES), updateCustomer);
router.patch("/status", deprecateRoute((req) => `/api/v1/customers/${req.body?.id || req.query.id || "{id}"}/status`), authorizeRoles(ADMIN_ROLES), toggleStatus);

router.get("/:id", authorizeRoles(ADMIN_ROLES), getCustomerByID);
router.put("/:id", authorizeRoles(ADMIN_ROLES), updateCustomer);
router.patch("/:id/status", authorizeRoles(ADMIN_ROLES), toggleStatus);

export default router;
