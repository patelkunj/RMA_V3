import { Router } from "express";
import { verifyJWT } from "../middlewares/auth.middleware.js";
import { authorizeRoles } from "../middlewares/authorisation.middleware.js";
import { verifyApiKey } from "../middlewares/apiKey.middleware.js";
import { createHook, createKey, list, ping, revokeKey } from "../controllers/integration.controller.js";
import { deprecateRoute } from "../middlewares/deprecation.middleware.js";

const router = Router();
router.get("/ping", verifyApiKey, ping);
router.use(verifyJWT, authorizeRoles(["ADMIN", "SUPER_ADMIN"]));
router.get("/organizations/:organizationId", list);
router.post("/api-keys", createKey);
router.delete("/api-keys/:id", revokeKey);
router.post("/webhooks", createHook);
router.get("/:organizationId", deprecateRoute((req) => `/api/v1/integrations/organizations/${req.params.organizationId}`), list);
export default router;
