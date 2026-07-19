import { Router } from "express";
import { verifyJWT } from "../middlewares/auth.middleware.js";
import { authorizeRoles } from "../middlewares/authorisation.middleware.js";
import { disable, enable, setup } from "../controllers/mfa.controller.js";

const router = Router();
router.use(verifyJWT, authorizeRoles(["ADMIN", "SUPER_ADMIN", "TECHNICIAN", "CUSTOMER"]));
router.post("/setup", setup);
router.post("/enable", enable);
router.post("/disable", disable);
export default router;
