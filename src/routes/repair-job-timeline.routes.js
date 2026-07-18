import { Router } from "express";
import { verifyJWT } from "../middlewares/auth.middleware.js";
import { authorizeRoles } from "../middlewares/authorisation.middleware.js";
import {
    auditCreate,
    auditList,
    trackingList,
} from "../controllers/repairjobtimeline.controller.js";
import { deprecateRoute } from "../middlewares/deprecation.middleware.js";

const router = Router();
const TIMELINE_ROLES = ["ADMIN", "SUPER_ADMIN", "TECHNICIAN", "CUSTOMER"];
const INTERNAL_ROLES = ["ADMIN", "SUPER_ADMIN", "TECHNICIAN"];

router.use(verifyJWT, authorizeRoles(TIMELINE_ROLES));

router.get("/:repairJobId/audit-logs", auditList);
router.post("/audit-logs", authorizeRoles(INTERNAL_ROLES), auditCreate);
router.get("/:repairJobId/tracking", trackingList);
router.post("/audit-logs/list", deprecateRoute("/api/v1/repair-job-timeline/{repairJobId}/audit-logs"), auditList);
router.post("/tracking/list", deprecateRoute("/api/v1/repair-job-timeline/{repairJobId}/tracking"), trackingList);

export default router;
