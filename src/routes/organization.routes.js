import { Router } from "express";
import { verifyJWT } from "../middlewares/auth.middleware.js";
import { authorizeRoles } from "../middlewares/authorisation.middleware.js";
import {
    createOrganization,
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
import { deprecateRoute } from "../middlewares/deprecation.middleware.js";

const router = Router();
const ADMIN_ROLES = ["ADMIN", "SUPER_ADMIN"];
const LOGO_READ_ROLES = ["ADMIN", "SUPER_ADMIN", "TECHNICIAN", "CUSTOMER"];

router.use(verifyJWT);

router.patch("/toggle", deprecateRoute((req) => `/api/v1/organizations/${req.body?.id || req.query.id || "{id}"}/status`), authorizeRoles(["SUPER_ADMIN"]), toggleStatus);
router.patch("/status", deprecateRoute((req) => `/api/v1/organizations/${req.body?.id || req.query.id || "{id}"}/status`), authorizeRoles(["SUPER_ADMIN"]), toggleStatus);

router.get("/:id/logo", authorizeRoles(LOGO_READ_ROLES), downloadLogo);
router.put("/:id/logo", authorizeRoles(ADMIN_ROLES), uploadRateLimit, uploadOrganizationLogo, scanUploads, uploadLogo);
router.delete("/:id/logo", authorizeRoles(ADMIN_ROLES), deleteLogo);

router.route("/")
    .get(authorizeRoles(ADMIN_ROLES), listOrganization)
    .post(authorizeRoles(["SUPER_ADMIN"]), createOrganization);
router.put("/", deprecateRoute((req) => `/api/v1/organizations/${req.body?.id || "{id}"}`), authorizeRoles(ADMIN_ROLES), updateOrganization);

router.get("/:id", authorizeRoles(ADMIN_ROLES), getOrganizationDetail);
router.put("/:id", authorizeRoles(ADMIN_ROLES), updateOrganization);
router.patch("/:id/status", authorizeRoles(["SUPER_ADMIN"]), toggleStatus);

export default router;
