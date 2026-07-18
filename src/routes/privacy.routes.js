import { Router } from "express";
import { verifyJWT } from "../middlewares/auth.middleware.js";
import { authorizeRoles } from "../middlewares/authorisation.middleware.js";
import { create, exportData, list } from "../controllers/privacy.controller.js";

const router = Router();
router.use(verifyJWT, authorizeRoles(["ADMIN", "SUPER_ADMIN", "CUSTOMER"]));
router.get("/export", exportData);
router.post("/requests", create);
router.get("/requests", list);
export default router;
