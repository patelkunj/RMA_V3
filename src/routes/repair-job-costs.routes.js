import { Router } from "express";
import { verifyJWT } from "../middlewares/auth.middleware.js";
import { authorizeRoles } from "../middlewares/authorisation.middleware.js";
import {
    addRepairCost,
    list,
    updateRepairCost,
} from "../controllers/repairjobcosting.controller.js";
import { deprecateRoute } from "../middlewares/deprecation.middleware.js";

const router = Router();
const INTERNAL_ROLES = ["ADMIN", "SUPER_ADMIN", "TECHNICIAN"];

router.use(verifyJWT, authorizeRoles(INTERNAL_ROLES));

router.get("/", list);
router.post("/", addRepairCost);

router.post("/list", deprecateRoute("/api/v1/repair-job-costs?repairJobId={repairJobId}"), list);
router.post("/add", deprecateRoute("/api/v1/repair-job-costs"), addRepairCost);
router.put("/update", deprecateRoute("/api/v1/repair-job-costs/{id}"), updateRepairCost);
router.put("/", deprecateRoute("/api/v1/repair-job-costs/{id}"), updateRepairCost);
router.put("/:id", updateRepairCost);

export default router;
