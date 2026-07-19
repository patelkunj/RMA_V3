import { Router } from "express";
import { verifyJWT } from "../middlewares/auth.middleware.js";
import { authorizeRoles } from "../middlewares/authorisation.middleware.js";
import { upload } from "../middlewares/multer.middleware.js";
import { uploadRateLimit } from "../middlewares/rateLimit.middleware.js";
import { idempotent } from "../middlewares/idempotency.middleware.js";
import { scanUploads } from "../middlewares/uploadSecurity.middleware.js";
import {
    insertMultipleRepairJobs,
    insertRepairJob,
    listRepairJob,
    receiveJob,
    repairJob,
    serialNumberLookup,
    updateDispatchId,
    updateRepairJobSKU,
    updateRepairJobSerialNumber,
    updateStatus,
    updateTrackingNumber,
} from "../controllers/repairjob.controller.js";
import {
    assign, estimateCreate, estimateDecision, listRequests, reviewRequest,
    submitRequest, transition, workflowDetail, workLogCreate,
} from "../controllers/repairworkflow.controller.js";
import { detail as deviceCredentialDetail } from "../controllers/deviceCredential.controller.js";
import { deprecateRoute } from "../middlewares/deprecation.middleware.js";

const router = Router();
const INTERNAL_ROLES = ["ADMIN", "SUPER_ADMIN", "TECHNICIAN"];
const ADMIN_ROLES = ["ADMIN", "SUPER_ADMIN"];
const CUSTOMER_VISIBLE_ROLES = ["ADMIN", "SUPER_ADMIN", "CUSTOMER"];

router.use(verifyJWT);

router.get("/requests", authorizeRoles(["ADMIN", "SUPER_ADMIN", "CUSTOMER"]), listRequests);
router.post("/requests", authorizeRoles(["CUSTOMER"]), uploadRateLimit, upload.any(), scanUploads, idempotent(), submitRequest);
router.patch("/requests/:id/review", authorizeRoles(ADMIN_ROLES), reviewRequest);
router.patch("/estimates/:estimateId/decision", authorizeRoles(["CUSTOMER"]), estimateDecision);

router.get("/", listRepairJob);
router.post("/", authorizeRoles(CUSTOMER_VISIBLE_ROLES), uploadRateLimit, upload.any(), scanUploads, idempotent(), insertRepairJob);
router.post("/bulk", authorizeRoles(ADMIN_ROLES), uploadRateLimit, upload.any(), scanUploads, insertMultipleRepairJobs);
router.post("/serial-number-lookup", authorizeRoles(CUSTOMER_VISIBLE_ROLES), serialNumberLookup);

router.post("/list_repairjob", deprecateRoute("/api/v1/repair-jobs"), listRepairJob);
router.post("/add_repairjob", deprecateRoute("/api/v1/repair-jobs"), authorizeRoles(ADMIN_ROLES), uploadRateLimit, upload.any(), scanUploads, insertRepairJob);
router.post("/add_multipal_repairjob", deprecateRoute("/api/v1/repair-jobs/bulk"), authorizeRoles(ADMIN_ROLES), uploadRateLimit, upload.any(), scanUploads, insertMultipleRepairJobs);
router.post("/serial_number_lookup", deprecateRoute("/api/v1/repair-jobs/serial-number-lookup"), authorizeRoles(CUSTOMER_VISIBLE_ROLES), serialNumberLookup);

router.put("/updateTrackingNumber", deprecateRoute("/api/v1/repair-jobs/{id}/tracking-number"), authorizeRoles(CUSTOMER_VISIBLE_ROLES), updateTrackingNumber);
router.patch("/tracking-number", deprecateRoute("/api/v1/repair-jobs/{id}/tracking-number"), authorizeRoles(CUSTOMER_VISIBLE_ROLES), updateTrackingNumber);
router.put("/updateSKU", deprecateRoute("/api/v1/repair-jobs/{id}/sku"), authorizeRoles(ADMIN_ROLES), updateRepairJobSKU);
router.patch("/sku", deprecateRoute("/api/v1/repair-jobs/{id}/sku"), authorizeRoles(ADMIN_ROLES), updateRepairJobSKU);
router.put("/updateSerialNumber", deprecateRoute("/api/v1/repair-jobs/{id}/serial-number"), authorizeRoles(ADMIN_ROLES), updateRepairJobSerialNumber);
router.patch("/serial-number", deprecateRoute("/api/v1/repair-jobs/{id}/serial-number"), authorizeRoles(ADMIN_ROLES), updateRepairJobSerialNumber);
router.put("/updateStatus", deprecateRoute("/api/v1/repair-jobs/{id}/status"), authorizeRoles(ADMIN_ROLES), updateStatus);
router.patch("/status", deprecateRoute("/api/v1/repair-jobs/{id}/status"), authorizeRoles(ADMIN_ROLES), updateStatus);

router.get("/:id/workflow", authorizeRoles(["ADMIN", "SUPER_ADMIN", "TECHNICIAN", "CUSTOMER"]), workflowDetail);
router.get("/:id/device-credential", authorizeRoles(INTERNAL_ROLES), deviceCredentialDetail);
router.patch("/:id/assignment", authorizeRoles(ADMIN_ROLES), assign);
router.patch("/:id/status", authorizeRoles(INTERNAL_ROLES), transition);
router.post("/:id/work-logs", authorizeRoles(INTERNAL_ROLES), workLogCreate);
router.post("/:id/estimates", authorizeRoles(INTERNAL_ROLES), estimateCreate);
router.patch("/:id/tracking-number", authorizeRoles(CUSTOMER_VISIBLE_ROLES), updateTrackingNumber);
router.patch("/:id/sku", authorizeRoles(ADMIN_ROLES), updateRepairJobSKU);
router.patch("/:id/serial-number", authorizeRoles(ADMIN_ROLES), updateRepairJobSerialNumber);
router.patch("/:id/dispatch-id", authorizeRoles(INTERNAL_ROLES), updateDispatchId);
router.patch("/:id/receive", authorizeRoles(INTERNAL_ROLES), receiveJob);

router.put("/updateDispatchId", deprecateRoute("/api/v1/repair-jobs/{id}/dispatch-id"), authorizeRoles(INTERNAL_ROLES), updateDispatchId);
router.patch("/dispatch-id", deprecateRoute("/api/v1/repair-jobs/{id}/dispatch-id"), authorizeRoles(INTERNAL_ROLES), updateDispatchId);

router.post("/repairJob", deprecateRoute("/api/v1/repair-jobs/{id}"), authorizeRoles(INTERNAL_ROLES), repairJob);
router.post("/find", deprecateRoute("/api/v1/repair-jobs/{id}"), authorizeRoles(INTERNAL_ROLES), repairJob);

router.put("/receivejob", deprecateRoute("/api/v1/repair-jobs/{id}/receive"), authorizeRoles(INTERNAL_ROLES), receiveJob);
router.patch("/receive", deprecateRoute("/api/v1/repair-jobs/{id}/receive"), authorizeRoles(INTERNAL_ROLES), receiveJob);

router.get("/:id", authorizeRoles(INTERNAL_ROLES), repairJob);

export default router;
