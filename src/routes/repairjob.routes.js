import { Router } from "express";
import { verifyJWT } from "../middlewares/auth.middleware.js";
import { authorizeRoles } from "../middlewares/authorisation.middleware.js";
import { upload } from "../middlewares/multer.middleware.js";
import { uploadRateLimit } from "../middlewares/rateLimit.middleware.js";
import { idempotent } from "../middlewares/idempotency.middleware.js";
import { scanUploads } from "../middlewares/uploadSecurity.middleware.js";
import {
    insertMultipalReapirJob,
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

const router = Router();
const INTERNAL_ROLES = ["ADMIN", "SUPER_ADMIN", "TECHNICIAN"];
const ADMIN_ROLES = ["ADMIN", "SUPER_ADMIN"];
const CUSTOMER_VISIBLE_ROLES = ["ADMIN", "SUPER_ADMIN", "CUSTOMER"];

router.use(verifyJWT);

router.get("/requests", authorizeRoles(["ADMIN", "SUPER_ADMIN", "CUSTOMER"]), listRequests);
router.post("/requests", authorizeRoles(["CUSTOMER"]), uploadRateLimit, upload.any(), scanUploads, idempotent(), submitRequest);
router.patch("/requests/:id/review", authorizeRoles(ADMIN_ROLES), reviewRequest);
router.patch("/estimates/:estimateId/decision", authorizeRoles(["CUSTOMER"]), estimateDecision);

router.post("/list_repairjob", listRepairJob);
router.get("/", listRepairJob);
router.post("/", authorizeRoles(CUSTOMER_VISIBLE_ROLES), uploadRateLimit, upload.any(), scanUploads, idempotent(), insertRepairJob);

router.post("/add_repairjob", authorizeRoles(ADMIN_ROLES), uploadRateLimit, upload.any(), scanUploads, insertRepairJob);
router.post("/add_multipal_repairjob", authorizeRoles(ADMIN_ROLES), uploadRateLimit, upload.any(), scanUploads, insertMultipalReapirJob);
router.post("/bulk", authorizeRoles(ADMIN_ROLES), uploadRateLimit, upload.any(), scanUploads, insertMultipalReapirJob);

router.post("/serial_number_lookup", authorizeRoles(CUSTOMER_VISIBLE_ROLES), serialNumberLookup);
router.post("/serial-number-lookup", authorizeRoles(CUSTOMER_VISIBLE_ROLES), serialNumberLookup);

router.put("/updateTrackingNumber", authorizeRoles(CUSTOMER_VISIBLE_ROLES), updateTrackingNumber);
router.patch("/tracking-number", authorizeRoles(CUSTOMER_VISIBLE_ROLES), updateTrackingNumber);

router.put("/updateSKU", authorizeRoles(ADMIN_ROLES), updateRepairJobSKU);
router.patch("/sku", authorizeRoles(ADMIN_ROLES), updateRepairJobSKU);

router.put("/updateSerialNumber", authorizeRoles(ADMIN_ROLES), updateRepairJobSerialNumber);
router.patch("/serial-number", authorizeRoles(ADMIN_ROLES), updateRepairJobSerialNumber);

router.put("/updateStatus", authorizeRoles(ADMIN_ROLES), updateStatus);
router.patch("/status", authorizeRoles(ADMIN_ROLES), updateStatus);

router.get("/:id/workflow", authorizeRoles(["ADMIN", "SUPER_ADMIN", "TECHNICIAN", "CUSTOMER"]), workflowDetail);
router.get("/:id/device-credential", authorizeRoles(INTERNAL_ROLES), deviceCredentialDetail);
router.patch("/:id/assignment", authorizeRoles(ADMIN_ROLES), assign);
router.patch("/:id/status", authorizeRoles(INTERNAL_ROLES), transition);
router.post("/:id/work-logs", authorizeRoles(INTERNAL_ROLES), workLogCreate);
router.post("/:id/estimates", authorizeRoles(INTERNAL_ROLES), estimateCreate);

router.put("/updateDispatchId", authorizeRoles(INTERNAL_ROLES), updateDispatchId);
router.patch("/dispatch-id", authorizeRoles(INTERNAL_ROLES), updateDispatchId);

router.post("/repairJob", authorizeRoles(INTERNAL_ROLES), repairJob);
router.post("/find", authorizeRoles(INTERNAL_ROLES), repairJob);

router.put("/receivejob", authorizeRoles(INTERNAL_ROLES), receiveJob);
router.patch("/receive", authorizeRoles(INTERNAL_ROLES), receiveJob);

export default router;
