import { Router } from "express";
import { verifyJWT } from "../middlewares/auth.middleware.js";
import { authorizeRoles } from "../middlewares/authorisation.middleware.js";
import {
    deactivate,
    detail,
    download,
    list,
} from "../controllers/document.controller.js";

const router = Router();
const DOCUMENT_ROLES = ["ADMIN", "SUPER_ADMIN", "TECHNICIAN", "CUSTOMER"];
const INTERNAL_ROLES = ["ADMIN", "SUPER_ADMIN", "TECHNICIAN"];

router.use(verifyJWT, authorizeRoles(DOCUMENT_ROLES));

router.get("/", list);
router.post("/list", list);
router.get("/:id/download", download);
router.get("/:id", detail);
router.patch("/:id/deactivate", authorizeRoles(INTERNAL_ROLES), deactivate);
router.patch("/deactivate", authorizeRoles(INTERNAL_ROLES), deactivate);

export default router;
