import { Router } from "express";
import { verifyJWT } from "../middlewares/auth.middleware.js";
import { authorizeRoles } from "../middlewares/authorisation.middleware.js";
import { upload } from "../middlewares/multer.middleware.js";
import { uploadRateLimit } from "../middlewares/rateLimit.middleware.js";
import {
    insertChat,
    listChat,
    toggleRead,
    unreadCount,
} from "../controllers/chats.controller.js";

const router = Router();
const CHAT_ROLES = ["ADMIN", "SUPER_ADMIN", "TECHNICIAN", "CUSTOMER"];

router.use(verifyJWT, authorizeRoles(CHAT_ROLES));

router.post("/list", listChat);
router.post("/create", uploadRateLimit, upload.any(), insertChat);
router.put("/toggle-read", toggleRead);
router.post("/unread-count", unreadCount);

router.route("/")
    .post(uploadRateLimit, upload.any(), insertChat);
router.patch("/read", toggleRead);

export default router;
