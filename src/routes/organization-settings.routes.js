import { Router } from "express";
import { verifyJWT } from "../middlewares/auth.middleware.js";
import { authorizeRoles } from "../middlewares/authorisation.middleware.js";
import { detail, update } from "../controllers/organizationSettings.controller.js";

const router = Router();
router.use(verifyJWT, authorizeRoles(["ADMIN", "SUPER_ADMIN"]));
router.get("/:organizationId", detail);
router.put("/:organizationId", update);
export default router;
