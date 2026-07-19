import { Router } from "express";
import { verifyJWT } from "../middlewares/auth.middleware.js";
import { authorizeRoles } from "../middlewares/authorisation.middleware.js";
import { create, updateStatus } from "../controllers/logistics.controller.js";

const router = Router();
router.use(verifyJWT, authorizeRoles(["ADMIN", "SUPER_ADMIN", "TECHNICIAN"]));
router.post("/repair-jobs/:repairJobId", create);
router.patch("/:id/status", updateStatus);
export default router;
