import { Router } from "express";
import { verifyJWT } from "../middlewares/auth.middleware.js";
import {authorizeRoles} from "../middlewares/authorisation.middleware.js"
import { 
    listAllProduct,
    searchProduct,
    insertProduct,
    updateProduct,
    listProducts
} from "../controllers/product.controller.js";

const router = Router()


//Secure routes
// verfiyJWT is middleware
router.route("/").get(verifyJWT,authorizeRoles(["ADMIN","SUPER_ADMIN"]),listProducts)
router.route("/search").post(verifyJWT,authorizeRoles(["ADMIN","SUPER_ADMIN"]),searchProduct)
router.route("/").post(verifyJWT,authorizeRoles(["ADMIN","SUPER_ADMIN"]),insertProduct)
router.route("/").put(verifyJWT,authorizeRoles(["ADMIN","SUPER_ADMIN"]),updateProduct)
//router.route("/product").post(verifyJWT,authorizeRoles(["Admin","Super Admin","Customer"]),listProducts)

export default router