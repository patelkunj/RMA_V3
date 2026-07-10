import { Router } from "express";
import { verifyJWT } from "../middlewares/auth.middleware.js";
import { authorizeRoles } from "../middlewares/authorisation.middleware.js";
import {
    auditCreate,
    auditList,
    trackingList,
} from "../controllers/repairjobtimeline.controller.js";

const router = Router();
const TIMELINE_ROLES = ["ADMIN", "SUPER_ADMIN", "TECHNICIAN", "CUSTOMER"];
const INTERNAL_ROLES = ["ADMIN", "SUPER_ADMIN", "TECHNICIAN"];

router.use(verifyJWT, authorizeRoles(TIMELINE_ROLES));

router.get("/:repairJobId/audit-logs", auditList);
router.post("/audit-logs/list", auditList);
router.post("/audit-logs", authorizeRoles(INTERNAL_ROLES), auditCreate);
router.get("/:repairJobId/tracking", trackingList);
router.post("/tracking/list", trackingList);

export default router;
