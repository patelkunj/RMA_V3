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
    emailInvoice,
    invoice,
    serviceReport,
} from "../controllers/pdfreport.controller.js";
import { deprecateRoute } from "../middlewares/deprecation.middleware.js";

const router = Router();
const REPORT_ROLES = ["ADMIN", "SUPER_ADMIN"];
const JOB_PDF_ROLES = ["ADMIN", "SUPER_ADMIN", "TECHNICIAN", "CUSTOMER"];
const BILLING_ROLES = ["ADMIN", "SUPER_ADMIN"];

router.get("/repair-jobs/:repairJobId/service-report.pdf", verifyJWT, authorizeRoles(JOB_PDF_ROLES), serviceReport);
router.get("/repair-jobs/:repairJobId/invoice.pdf", verifyJWT, authorizeRoles(JOB_PDF_ROLES), invoice);
router.post("/repair-jobs/:repairJobId/invoice/email", verifyJWT, authorizeRoles(BILLING_ROLES), emailInvoice);
router.get("/service-report/:repairJobId.pdf", deprecateRoute((req) => `/api/v1/reports/repair-jobs/${req.params.repairJobId}/service-report.pdf`), verifyJWT, authorizeRoles(JOB_PDF_ROLES), serviceReport);
router.get("/invoice/:repairJobId.pdf", deprecateRoute((req) => `/api/v1/reports/repair-jobs/${req.params.repairJobId}/invoice.pdf`), verifyJWT, authorizeRoles(JOB_PDF_ROLES), invoice);
router.post("/invoice/:repairJobId/email", deprecateRoute((req) => `/api/v1/reports/repair-jobs/${req.params.repairJobId}/invoice/email`), verifyJWT, authorizeRoles(BILLING_ROLES), emailInvoice);
router.post("/service-report", deprecateRoute("/api/v1/reports/repair-jobs/{repairJobId}/service-report.pdf"), verifyJWT, authorizeRoles(JOB_PDF_ROLES), serviceReport);
router.post("/invoice", deprecateRoute("/api/v1/reports/repair-jobs/{repairJobId}/invoice.pdf"), verifyJWT, authorizeRoles(JOB_PDF_ROLES), invoice);

router.use(verifyJWT, authorizeRoles(REPORT_ROLES));

router.get("/summary", getSummaryReport);
router.get("/backlog", getBacklogReport);
router.get("/throughput", getThroughputReport);
router.get("/costs", getCostReport);
router.get("/products", getProductReport);
router.get("/customers", getCustomerReport);
router.post("/summary", deprecateRoute("/api/v1/reports/summary"), getSummaryReport);
router.post("/backlog", deprecateRoute("/api/v1/reports/backlog"), getBacklogReport);
router.post("/throughput", deprecateRoute("/api/v1/reports/throughput"), getThroughputReport);
router.post("/costs", deprecateRoute("/api/v1/reports/costs"), getCostReport);
router.post("/products", deprecateRoute("/api/v1/reports/products"), getProductReport);
router.post("/customers", deprecateRoute("/api/v1/reports/customers"), getCustomerReport);

export default router;
