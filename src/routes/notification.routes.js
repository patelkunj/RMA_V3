import { Router } from "express";
import { verifyJWT } from "../middlewares/auth.middleware.js";
import { authorizeRoles } from "../middlewares/authorisation.middleware.js";
import {
    createManual,
    listAll,
    listMine,
    markRead,
    unreadCount,
} from "../controllers/notification.controller.js";
import { detail as preferenceDetail, update as preferenceUpdate } from "../controllers/notificationPreference.controller.js";
import { stream } from "../controllers/notificationStream.controller.js";
import { deprecateRoute } from "../middlewares/deprecation.middleware.js";

const router = Router();
const ADMIN_ROLES = ["ADMIN", "SUPER_ADMIN"];
const NOTIFICATION_ROLES = ["ADMIN", "SUPER_ADMIN", "TECHNICIAN", "CUSTOMER"];

router.use(verifyJWT, authorizeRoles(NOTIFICATION_ROLES));

router.get("/preferences", preferenceDetail);
router.put("/preferences", preferenceUpdate);
router.get("/stream", stream);

router.get("/", listMine);
router.get("/unread-count", unreadCount);
router.get("/admin", authorizeRoles(ADMIN_ROLES), listAll);
router.post("/admin", authorizeRoles(ADMIN_ROLES), createManual);

router.post("/list", deprecateRoute("/api/v1/notifications"), listMine);
router.post("/unread-count", deprecateRoute("/api/v1/notifications/unread-count"), unreadCount);
router.patch("/read", deprecateRoute("/api/v1/notifications/{id}/read"), markRead);
router.get("/admin/all", deprecateRoute("/api/v1/notifications/admin"), authorizeRoles(ADMIN_ROLES), listAll);
router.post("/admin/list", deprecateRoute("/api/v1/notifications/admin"), authorizeRoles(ADMIN_ROLES), listAll);
router.post("/", deprecateRoute("/api/v1/notifications/admin"), authorizeRoles(ADMIN_ROLES), createManual);
router.patch("/:id/read", markRead);

export default router;
