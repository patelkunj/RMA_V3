import { Router } from "express";
import { verifyJWT } from "../middlewares/auth.middleware.js";
import { authorizeRoles } from "../middlewares/authorisation.middleware.js";
import {
    creatOrganization,
    getOrganizationDetail,
    listOrganization,
    toggleStatus,
    updateOrganization,
} from "../controllers/organization.controller.js";

const router = Router();
const ADMIN_ROLES = ["ADMIN", "SUPER_ADMIN"];

router.use(verifyJWT);

router.patch("/toggle", authorizeRoles(["SUPER_ADMIN"]), toggleStatus);
router.patch("/status", authorizeRoles(["SUPER_ADMIN"]), toggleStatus);

router.route("/")
    .get(authorizeRoles(ADMIN_ROLES), listOrganization)
    .post(authorizeRoles(["SUPER_ADMIN"]), creatOrganization)
    .put(authorizeRoles(ADMIN_ROLES), updateOrganization);

router.get("/:id", authorizeRoles(ADMIN_ROLES), getOrganizationDetail);

export default router;
