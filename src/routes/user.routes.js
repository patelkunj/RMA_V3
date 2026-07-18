import { Router } from "express";
import { verifyJWT } from "../middlewares/auth.middleware.js";
import { authorizeRoles } from "../middlewares/authorisation.middleware.js";
import { authRateLimit } from "../middlewares/rateLimit.middleware.js";
import {
    activeUser,
    changeCurrentPassword,
    forgetPassword,
    getUserById,
    getUserDetail,
    listUser,
    loginUser,
    logoutUser,
    registerUser,
    toggleStatus,
    updateUser,
} from "../controllers/user.controller.js";
import { refresh } from "../controllers/session.controller.js";
import { deprecateRoute } from "../middlewares/deprecation.middleware.js";

const router = Router();
const INTERNAL_ROLES = ["ADMIN", "SUPER_ADMIN", "TECHNICIAN"];
const ADMIN_ROLES = ["ADMIN", "SUPER_ADMIN"];

router.post("/login", authRateLimit, loginUser);
router.get("/activate/:token", authRateLimit, activeUser);
router.post("/password-reset/request", authRateLimit, getUserDetail);
router.post("/password-reset/:token", authRateLimit, forgetPassword);

router.post("/refresh-token", deprecateRoute("/api/v1/sessions/refresh"), authRateLimit, refresh);
router.get("/activeuser/:token", deprecateRoute((req) => `/api/v1/users/activate/${req.params.token}`), authRateLimit, activeUser);
router.post("/getUserDetail", deprecateRoute("/api/v1/users/password-reset/request"), authRateLimit, getUserDetail);
router.post("/forgetPassword/:token", deprecateRoute((req) => `/api/v1/users/password-reset/${req.params.token}`), authRateLimit, forgetPassword);

router.use(verifyJWT);

router.post("/logout", logoutUser);
router.patch("/password", authorizeRoles(INTERNAL_ROLES), changeCurrentPassword);

router.post("/change_password", deprecateRoute("/api/v1/users/password"), authorizeRoles(INTERNAL_ROLES), changeCurrentPassword);
router.post("/register", deprecateRoute("/api/v1/users"), authorizeRoles(ADMIN_ROLES), registerUser);
router.post("/list_user", deprecateRoute("/api/v1/users"), authorizeRoles(ADMIN_ROLES), listUser);
router.post("/user", deprecateRoute((req) => `/api/v1/users/${req.body?.id || "{id}"}`), authorizeRoles(ADMIN_ROLES), getUserById);
router.put("/update_user", deprecateRoute((req) => `/api/v1/users/${req.body?.id || "{id}"}`), authorizeRoles(ADMIN_ROLES), updateUser);
router.put("/toggle", deprecateRoute((req) => `/api/v1/users/${req.body?.id || req.query.id || "{id}"}/status`), authorizeRoles(ADMIN_ROLES), toggleStatus);

router.route("/")
    .get(authorizeRoles(ADMIN_ROLES), listUser)
    .post(authorizeRoles(ADMIN_ROLES), registerUser);
router.put("/", deprecateRoute((req) => `/api/v1/users/${req.body?.id || "{id}"}`), authorizeRoles(ADMIN_ROLES), updateUser);
router.post("/find", deprecateRoute((req) => `/api/v1/users/${req.body?.id || "{id}"}`), authorizeRoles(ADMIN_ROLES), getUserById);
router.patch("/status", deprecateRoute((req) => `/api/v1/users/${req.body?.id || req.query.id || "{id}"}/status`), authorizeRoles(ADMIN_ROLES), toggleStatus);

router.get("/:id", authorizeRoles(ADMIN_ROLES), getUserById);
router.put("/:id", authorizeRoles(ADMIN_ROLES), updateUser);
router.patch("/:id/status", authorizeRoles(ADMIN_ROLES), toggleStatus);

export default router;
