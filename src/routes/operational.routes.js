import { Router } from "express";
import { live, metrics, processOutbox, processSla, ready } from "../controllers/operational.controller.js";
import { verifyJWT } from "../middlewares/auth.middleware.js";
import { authorizeRoles } from "../middlewares/authorisation.middleware.js";
import { apiRateLimit } from "../middlewares/rateLimit.middleware.js";

const router = Router();

router.get("/health/live", live);
router.get("/health/ready", ready);
router.get("/metrics", metrics);
router.post("/api/v1/operations/outbox/process", apiRateLimit, verifyJWT, authorizeRoles(["SUPER_ADMIN"]), processOutbox);
router.post("/api/v1/operations/sla/process", apiRateLimit, verifyJWT, authorizeRoles(["SUPER_ADMIN"]), processSla);

export default router;
