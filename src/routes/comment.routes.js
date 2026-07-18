import { Router } from "express";
import { verifyJWT } from "../middlewares/auth.middleware.js";
import { authorizeRoles } from "../middlewares/authorisation.middleware.js";
import { upload } from "../middlewares/multer.middleware.js";
import { uploadRateLimit } from "../middlewares/rateLimit.middleware.js";
import { scanUploads } from "../middlewares/uploadSecurity.middleware.js";
import {
    insertComment,
    listComment,
    updateComment,
} from "../controllers/comment.controller.js";
import { deprecateRoute } from "../middlewares/deprecation.middleware.js";

const router = Router();
const INTERNAL_ROLES = ["ADMIN", "SUPER_ADMIN", "TECHNICIAN"];

router.use(verifyJWT, authorizeRoles(INTERNAL_ROLES));

router.get("/repair-jobs/:repairJobId", listComment);
router.post("/repair-jobs/:repairJobId", uploadRateLimit, upload.any(), scanUploads, insertComment);
router.patch("/:id", updateComment);

router.post("/list", deprecateRoute("/api/v1/comments/repair-jobs/{repairJobId}"), listComment);
router.post("/create", deprecateRoute("/api/v1/comments/repair-jobs/{repairJobId}"), uploadRateLimit, upload.any(), scanUploads, insertComment);
router.put("/update", deprecateRoute("/api/v1/comments/{id}"), updateComment);
router.post("/", deprecateRoute("/api/v1/comments/repair-jobs/{repairJobId}"), uploadRateLimit, upload.any(), scanUploads, insertComment);
router.put("/", deprecateRoute("/api/v1/comments/{id}"), updateComment);

export default router;
