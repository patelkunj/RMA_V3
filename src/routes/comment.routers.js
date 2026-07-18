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

const router = Router();
const INTERNAL_ROLES = ["ADMIN", "SUPER_ADMIN", "TECHNICIAN"];

router.use(verifyJWT, authorizeRoles(INTERNAL_ROLES));

router.post("/list", listComment);
router.post("/create", uploadRateLimit, upload.any(), scanUploads, insertComment);
router.put("/update", updateComment);

router.route("/")
    .post(uploadRateLimit, upload.any(), scanUploads, insertComment)
    .put(updateComment);

export default router;
