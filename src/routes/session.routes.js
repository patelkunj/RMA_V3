import { Router } from "express";
import { verifyJWT } from "../middlewares/auth.middleware.js";
import {
    list,
    refresh,
    revoke,
    revokeAll,
} from "../controllers/session.controller.js";
import { authRateLimit } from "../middlewares/rateLimit.middleware.js";

const router = Router();

router.post("/refresh", authRateLimit, refresh);

router.use(verifyJWT);
router.get("/", list);
router.delete("/all", revokeAll);
router.delete("/:id", revoke);
router.post("/revoke", revoke);
router.post("/revoke-all", revokeAll);

export default router;
