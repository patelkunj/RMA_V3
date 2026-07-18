import { Router } from "express";
import { verifyJWT } from "../middlewares/auth.middleware.js";
import { authorizeRoles } from "../middlewares/authorisation.middleware.js";
import {
    creatOrganization,
    deleteLogo,
    downloadLogo,
    getOrganizationDetail,
    listOrganization,
    toggleStatus,
    updateOrganization,
    uploadLogo,
} from "../controllers/organization.controller.js";
import { uploadRateLimit } from "../middlewares/rateLimit.middleware.js";
import { uploadOrganizationLogo } from "../middlewares/multer.middleware.js";
import { scanUploads } from "../middlewares/uploadSecurity.middleware.js";

const router = Router();
const ADMIN_ROLES = ["ADMIN", "SUPER_ADMIN"];
const LOGO_READ_ROLES = ["ADMIN", "SUPER_ADMIN", "TECHNICIAN", "CUSTOMER"];

router.use(verifyJWT);

router.patch("/toggle", authorizeRoles(["SUPER_ADMIN"]), toggleStatus);
router.patch("/status", authorizeRoles(["SUPER_ADMIN"]), toggleStatus);

router.get("/:id/logo", authorizeRoles(LOGO_READ_ROLES), downloadLogo);
router.put("/:id/logo", authorizeRoles(ADMIN_ROLES), uploadRateLimit, uploadOrganizationLogo, scanUploads, uploadLogo);
router.delete("/:id/logo", authorizeRoles(ADMIN_ROLES), deleteLogo);

router.route("/")
    .get(authorizeRoles(ADMIN_ROLES), listOrganization)
    .post(authorizeRoles(["SUPER_ADMIN"]), creatOrganization)
    .put(authorizeRoles(ADMIN_ROLES), updateOrganization);

router.get("/:id", authorizeRoles(ADMIN_ROLES), getOrganizationDetail);

export default router;
