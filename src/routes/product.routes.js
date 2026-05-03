import { Router } from "express";
import { verfiyJWT } from "../middlewares/auth.middleware.js";
import {authorizeRoles} from "../middlewares/authorisation.middleware.js"
import { 
    listAllProduct,
    searchProudct,
    insertProduct,
    updateProduct,
    listProducts
} from "../controllers/product.controller.js";

const router = Router()


//Secure routes
// verfiyJWT is middleware
router.route("/").get(verfiyJWT,authorizeRoles(["Admin","Super Admin"]),listProducts)
router.route("/search").post(verfiyJWT,authorizeRoles(["Admin","Super Admin"]),searchProudct)
router.route("/").post(verfiyJWT,authorizeRoles(["Admin","Super Admin"]),insertProduct)
router.route("/").put(verfiyJWT,authorizeRoles(["Admin","Super Admin"]),updateProduct)
//router.route("/product").post(verfiyJWT,authorizeRoles(["Admin","Super Admin","Customer"]),listProducts)

export default router