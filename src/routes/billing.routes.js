import { Router } from "express";
import { verifyJWT } from "../middlewares/auth.middleware.js";
import { authorizeRoles } from "../middlewares/authorisation.middleware.js";
import { create, detail, pay, voidRecord } from "../controllers/billing.controller.js";
import { idempotent } from "../middlewares/idempotency.middleware.js";

const router = Router();
const ADMIN_ROLES = ["ADMIN", "SUPER_ADMIN"];
router.use(verifyJWT);
router.post("/repair-jobs/:repairJobId/invoices", authorizeRoles(ADMIN_ROLES), idempotent(), create);
router.get("/invoices/:id", authorizeRoles([...ADMIN_ROLES, "TECHNICIAN", "CUSTOMER"]), detail);
router.post("/invoices/:id/payments", authorizeRoles(ADMIN_ROLES), idempotent(), pay);
router.post("/invoices/:id/void", authorizeRoles(ADMIN_ROLES), voidRecord);
export default router;
