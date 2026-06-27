import { Router } from "express";
import { verifyJWT } from "../middlewares/auth.middleware.js";
import {authorizeRoles} from "../middlewares/authorisation.middleware.js"
import { 
        listRepairJob, 
        insertRepairJob,
        updateRepairJobSKU,
        updateRepairJobSerialNumber,
        serialNumberLookup,
        updateTrackingNumber,
        updateStatus,
        updateDispatchId,
        insertMultipalReapirJob,
        repairJob,
        receiveJob
 } from "../controllers/repairjob.controller.js"
 import { upload } from "../middlewares/multer.middleware.js";

const router = Router()


router.route("/add_multipal_repairjob").post(upload.any(),insertMultipalReapirJob)

//Secure routes
router.route("/list_repairjob").post(verifyJWT,listRepairJob)

//Authorised Routes
router.route("/updateTrackingNumber").put(verifyJWT,authorizeRoles(["ADMIN","SUPER_ADMIN","CUSTOMER"]),updateTrackingNumber)
router.route("/serial_number_lookup").post(verifyJWT,authorizeRoles(["ADMIN","SUPER_ADMIN","CUSTOMER"]),serialNumberLookup)
router.route("/add_repairjob").post(verifyJWT,authorizeRoles(["ADMIN","SUPER_ADMIN"]),upload.any(),insertRepairJob)
router.route("/updateSKU").put(verifyJWT,authorizeRoles(["ADMIN","SUPER_ADMIN"]),updateRepairJobSKU)
router.route("/updateSerialNumber").put(verifyJWT,authorizeRoles(["ADMIN","SUPER_ADMIN"]),updateRepairJobSerialNumber)
router.route("/updateStatus").put(verifyJWT,authorizeRoles(["ADMIN","SUPER_ADMIN"]), updateStatus)
router.route("/updateDispatchId").put(verifyJWT,authorizeRoles(["ADMIN","SUPER_ADMIN","TECHNICIAN"]), updateDispatchId)
router.route("/repairJob").post(verifyJWT,authorizeRoles(["ADMIN","SUPER_ADMIN","TECHNICIAN"]), repairJob)
router.route("/receivejob").put(verifyJWT,authorizeRoles(["ADMIN","SUPER_ADMIN","TECHNICIAN"]), receiveJob)

export default router