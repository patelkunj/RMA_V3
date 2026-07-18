import { Router } from "express";
import { verifyJWT } from "../middlewares/auth.middleware.js";
import { authorizeRoles } from "../middlewares/authorisation.middleware.js";
import { verifyApiKey } from "../middlewares/apiKey.middleware.js";
import { createHook, createKey, list, ping, revokeKey } from "../controllers/integration.controller.js";

const router = Router();
router.get("/ping", verifyApiKey, ping);
router.use(verifyJWT, authorizeRoles(["ADMIN", "SUPER_ADMIN"]));
router.get("/:organizationId", list);
router.post("/api-keys", createKey);
router.delete("/api-keys/:id", revokeKey);
router.post("/webhooks", createHook);
export default router;
