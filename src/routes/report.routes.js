import { Router } from "express";
import { verifyJWT } from "../middlewares/auth.middleware.js";
import { authorizeRoles } from "../middlewares/authorisation.middleware.js";
import {
    getBacklogReport,
    getCostReport,
    getCustomerReport,
    getProductReport,
    getSummaryReport,
    getThroughputReport,
} from "../controllers/report.controller.js";

const router = Router();
const REPORT_ROLES = ["ADMIN", "SUPER_ADMIN"];

router.use(verifyJWT, authorizeRoles(REPORT_ROLES));

router.route("/summary").get(getSummaryReport).post(getSummaryReport);
router.route("/backlog").get(getBacklogReport).post(getBacklogReport);
router.route("/throughput").get(getThroughputReport).post(getThroughputReport);
router.route("/costs").get(getCostReport).post(getCostReport);
router.route("/products").get(getProductReport).post(getProductReport);
router.route("/customers").get(getCustomerReport).post(getCustomerReport);

export default router;
