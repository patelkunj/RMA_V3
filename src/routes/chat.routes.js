import { Router } from "express";
import { verifyJWT } from "../middlewares/auth.middleware.js";
import { authorizeRoles } from "../middlewares/authorisation.middleware.js";
import { upload } from "../middlewares/multer.middleware.js";
import { uploadRateLimit } from "../middlewares/rateLimit.middleware.js";
import { scanUploads } from "../middlewares/uploadSecurity.middleware.js";
import {
    insertChat,
    listChat,
    toggleRead,
    unreadCount,
} from "../controllers/chats.controller.js";
import { deprecateRoute } from "../middlewares/deprecation.middleware.js";

const router = Router();
const CHAT_ROLES = ["ADMIN", "SUPER_ADMIN", "TECHNICIAN", "CUSTOMER"];

router.use(verifyJWT, authorizeRoles(CHAT_ROLES));

router.get("/repair-jobs/:repairJobId", listChat);
router.post("/repair-jobs/:repairJobId", uploadRateLimit, upload.any(), scanUploads, insertChat);
router.patch("/repair-jobs/:repairJobId/read", toggleRead);
router.get("/repair-jobs/:repairJobId/unread-count", unreadCount);

router.post("/list", deprecateRoute("/api/v1/chats/repair-jobs/{repairJobId}"), listChat);
router.post("/create", deprecateRoute("/api/v1/chats/repair-jobs/{repairJobId}"), uploadRateLimit, upload.any(), scanUploads, insertChat);
router.put("/toggle-read", deprecateRoute("/api/v1/chats/repair-jobs/{repairJobId}/read"), toggleRead);
router.post("/unread-count", deprecateRoute("/api/v1/chats/repair-jobs/{repairJobId}/unread-count"), unreadCount);
router.post("/", deprecateRoute("/api/v1/chats/repair-jobs/{repairJobId}"), uploadRateLimit, upload.any(), scanUploads, insertChat);
router.patch("/read", deprecateRoute("/api/v1/chats/repair-jobs/{repairJobId}/read"), toggleRead);

export default router;
