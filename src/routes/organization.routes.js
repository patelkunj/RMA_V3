import { Router } from "express";
import { verfiyJWT } from "../middlewares/auth.middleware.js";
import {authorizeRoles} from "../middlewares/authorisation.middleware.js"
import {listOrganization,
    creatOrganization,
    updateOrganization,
    toggleStatus,
    // searchCompany,
    // allCompany
} from "../controllers/organization.controller.js"

const router = Router()

//secure route
router.route("/").post(verfiyJWT,authorizeRoles(["Admin","Super Admin"]),creatOrganization)
router.route("/").put(verfiyJWT,authorizeRoles(["Admin","Super Admin"]),updateOrganization)
router.route("/").get(verfiyJWT,authorizeRoles(["Admin","Super Admin"]),listOrganization)
router.route("/toggle").patch(verfiyJWT,authorizeRoles(["Admin","Super Admin"]),toggleStatus)
// router.route("/search").post(verfiyJWT,authorizeRoles(["Admin","Super Admin"]),searchCompany)
// router.route("/all").post(verfiyJWT,authorizeRoles(["Admin","Super Admin"]),allCompany)

export default router
