import { Router } from "express";
import { verifyJWT } from "../middlewares/auth.middleware.js";
import { authorizeRoles } from "../middlewares/authorisation.middleware.js";
import { create, list, move } from "../controllers/inventory.controller.js";
import { idempotent } from "../middlewares/idempotency.middleware.js";

const router = Router();
const INTERNAL_ROLES = ["ADMIN", "SUPER_ADMIN", "TECHNICIAN"];
router.use(verifyJWT, authorizeRoles(INTERNAL_ROLES));
router.get("/", list);
router.post("/", authorizeRoles(["ADMIN", "SUPER_ADMIN"]), create);
router.post("/:id/movements", idempotent(), move);
export default router;
