import { Router } from "express";
import { verfiyJWT } from "../middlewares/auth.middleware.js";
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
router.route("/").post(verfiyJWT,authorizeRoles(["ADMIN","SUPER_ADMIN"]),creatOrganization)
router.route("/").put(verfiyJWT,authorizeRoles(["ADMIN","SUPER_ADMIN"]),updateOrganization)
router.route("/").get(verfiyJWT,authorizeRoles(["ADMIN","SUPER_ADMIN"]),listOrganization)
router.route("/:id").get(verfiyJWT,authorizeRoles(["ADMIN","SUPER_ADMIN"]),getOrganizationDetail)
router.route("/toggle").patch(verfiyJWT,authorizeRoles(["ADMIN","SUPER_ADMIN"]),toggleStatus)
// router.route("/search").post(verfiyJWT,authorizeRoles(["ADMIN","SUPER_ADMIN"]),searchCompany)
// router.route("/all").post(verfiyJWT,authorizeRoles(["ADMIN","SUPER_ADMIN"]),allCompany)

export default router
