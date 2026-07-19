import { Router } from "express";
import { verifyJWT } from "../middlewares/auth.middleware.js";
import {
    list,
    refresh,
    revoke,
    revokeAll,
} from "../controllers/session.controller.js";
import { authRateLimit } from "../middlewares/rateLimit.middleware.js";
import { deprecateRoute } from "../middlewares/deprecation.middleware.js";

const router = Router();

router.post("/refresh", authRateLimit, refresh);

router.use(verifyJWT);
router.get("/", list);
router.delete("/all", revokeAll);
router.delete("/:id", revoke);
router.post("/revoke", deprecateRoute("/api/v1/sessions/{id}"), revoke);
router.post("/revoke-all", deprecateRoute("/api/v1/sessions/all"), revokeAll);

export default router;
