import { Router } from "express";
import { verifyJWT } from "../middlewares/auth.middleware.js";
import { authorizeRoles } from "../middlewares/authorisation.middleware.js";
import {
    addRepairCost,
    list,
    updateRepairCost,
} from "../controllers/repairjobcosting.controller.js";

const router = Router();
const INTERNAL_ROLES = ["ADMIN", "SUPER_ADMIN", "TECHNICIAN"];

router.use(verifyJWT, authorizeRoles(INTERNAL_ROLES));

router.post("/list", list);
router.post("/add", addRepairCost);
router.put("/update", updateRepairCost);

router.route("/")
    .post(addRepairCost)
    .put(updateRepairCost);

export default router;
