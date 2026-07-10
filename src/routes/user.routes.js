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

const router = Router();
const INTERNAL_ROLES = ["ADMIN", "SUPER_ADMIN", "TECHNICIAN"];
const ADMIN_ROLES = ["ADMIN", "SUPER_ADMIN"];

router.post("/login", authRateLimit, loginUser);
router.get("/activeuser/:token", authRateLimit, activeUser);
router.post("/getUserDetail", authRateLimit, getUserDetail);
router.post("/forgetPassword/:token", authRateLimit, forgetPassword);

router.use(verifyJWT);

router.post("/logout", logoutUser);
router.post("/change_password", authorizeRoles(INTERNAL_ROLES), changeCurrentPassword);

router.post("/register", authorizeRoles(ADMIN_ROLES), registerUser);
router.post("/list_user", authorizeRoles(ADMIN_ROLES), listUser);
router.post("/user", authorizeRoles(ADMIN_ROLES), getUserById);
router.put("/update_user", authorizeRoles(ADMIN_ROLES), updateUser);
router.put("/toggle", authorizeRoles(ADMIN_ROLES), toggleStatus);

router.route("/")
    .get(authorizeRoles(ADMIN_ROLES), listUser)
    .post(authorizeRoles(ADMIN_ROLES), registerUser)
    .put(authorizeRoles(ADMIN_ROLES), updateUser);
router.post("/find", authorizeRoles(ADMIN_ROLES), getUserById);
router.patch("/status", authorizeRoles(ADMIN_ROLES), toggleStatus);

export default router;
