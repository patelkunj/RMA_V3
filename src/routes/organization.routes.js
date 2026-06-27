import { Router } from "express";
import { verifyJWT } from "../middlewares/auth.middleware.js";
import {authorizeRoles} from "../middlewares/authorisation.middleware.js"
import {listOrganization,
    creatOrganization,
    updateOrganization,
    toggleStatus,
    getOrganizationDetail,
    // searchCompany,
    // allCompany
} from "../controllers/organization.controller.js"

const router = Router()

//secure route
router.route("/").post(verifyJWT,authorizeRoles(["ADMIN","SUPER_ADMIN"]),creatOrganization)
router.route("/").put(verifyJWT,authorizeRoles(["ADMIN","SUPER_ADMIN"]),updateOrganization)
router.route("/").get(verifyJWT,authorizeRoles(["ADMIN","SUPER_ADMIN"]),listOrganization)
router.route("/:id").get(verifyJWT,authorizeRoles(["ADMIN","SUPER_ADMIN"]),getOrganizationDetail)
router.route("/toggle").patch(verifyJWT,authorizeRoles(["ADMIN","SUPER_ADMIN"]),toggleStatus)
// router.route("/search").post(verifyJWT,authorizeRoles(["ADMIN","SUPER_ADMIN"]),searchCompany)
// router.route("/all").post(verifyJWT,authorizeRoles(["ADMIN","SUPER_ADMIN"]),allCompany)

export default router
