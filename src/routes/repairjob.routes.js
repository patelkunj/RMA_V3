import { Router } from "express";
import { verfiyJWT } from "../middlewares/auth.middleware.js";
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
router.route("/list_repairjob").post(verfiyJWT,listRepairJob)

//Authorised Routes
router.route("/updateTrackingNumber").put(verfiyJWT,authorizeRoles(["Admin","Super Admin","Customer"]),updateTrackingNumber)
router.route("/serial_number_lookup").post(verfiyJWT,authorizeRoles(["Admin","Super Admin","Customer"]),serialNumberLookup)
router.route("/add_repairjob").post(verfiyJWT,authorizeRoles(["Admin","Super Admin"]),upload.any(),insertRepairJob)
router.route("/updateSKU").put(verfiyJWT,authorizeRoles(["Admin","Super Admin"]),updateRepairJobSKU)
router.route("/updateSerialNumber").put(verfiyJWT,authorizeRoles(["Admin","Super Admin"]),updateRepairJobSerialNumber)
router.route("/updateStatus").put(verfiyJWT,authorizeRoles(["Admin","Super Admin"]), updateStatus)
router.route("/updateDispatchId").put(verfiyJWT,authorizeRoles(["Admin","Super Admin","Technician"]), updateDispatchId)
router.route("/repairJob").post(verfiyJWT,authorizeRoles(["Admin","Super Admin","Technician"]), repairJob)
router.route("/receivejob").put(verfiyJWT,authorizeRoles(["Admin","Super Admin","Technician"]), receiveJob)

export default router