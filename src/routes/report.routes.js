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
import {
    invoice,
    serviceReport,
} from "../controllers/pdfreport.controller.js";

const router = Router();
const REPORT_ROLES = ["ADMIN", "SUPER_ADMIN"];
const JOB_PDF_ROLES = ["ADMIN", "SUPER_ADMIN", "TECHNICIAN", "CUSTOMER"];

router.get("/service-report/:repairJobId.pdf", verifyJWT, authorizeRoles(JOB_PDF_ROLES), serviceReport);
router.get("/invoice/:repairJobId.pdf", verifyJWT, authorizeRoles(JOB_PDF_ROLES), invoice);
router.post("/service-report", verifyJWT, authorizeRoles(JOB_PDF_ROLES), serviceReport);
router.post("/invoice", verifyJWT, authorizeRoles(JOB_PDF_ROLES), invoice);

router.use(verifyJWT, authorizeRoles(REPORT_ROLES));

router.route("/summary").get(getSummaryReport).post(getSummaryReport);
router.route("/backlog").get(getBacklogReport).post(getBacklogReport);
router.route("/throughput").get(getThroughputReport).post(getThroughputReport);
router.route("/costs").get(getCostReport).post(getCostReport);
router.route("/products").get(getProductReport).post(getProductReport);
router.route("/customers").get(getCustomerReport).post(getCustomerReport);

export default router;
