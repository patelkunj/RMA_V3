import { Router } from "express";
import { verifyJWT } from "../middlewares/auth.middleware.js";
import { authorizeRoles } from "../middlewares/authorisation.middleware.js";
import { upload } from "../middlewares/multer.middleware.js";
import { uploadRateLimit } from "../middlewares/rateLimit.middleware.js";
import { scanUploads } from "../middlewares/uploadSecurity.middleware.js";
import {
    insertSerialNumber,
    listSerialNumber,
    updateSerialNumber,
    uploadSerialNumber,
} from "../controllers/serialnumber.controller.js";

const router = Router();
const ADMIN_ROLES = ["ADMIN", "SUPER_ADMIN"];

router.use(verifyJWT, authorizeRoles(ADMIN_ROLES));

router.get("/", listSerialNumber);
router.post("/", insertSerialNumber);
router.put("/", updateSerialNumber);
router.post("/upload_serialnumber", uploadRateLimit, upload.single("file"), scanUploads, uploadSerialNumber);
router.post("/upload", uploadRateLimit, upload.single("file"), scanUploads, uploadSerialNumber);

export default router;
