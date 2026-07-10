import { Router } from "express";
import { verifyJWT } from "../middlewares/auth.middleware.js";
import { authorizeRoles } from "../middlewares/authorisation.middleware.js";
import {
    insertProduct,
    listProducts,
    searchProduct,
    updateProduct,
} from "../controllers/product.controller.js";

const router = Router();
const ADMIN_ROLES = ["ADMIN", "SUPER_ADMIN"];

router.use(verifyJWT, authorizeRoles(ADMIN_ROLES));

router.get("/", listProducts);
router.post("/", insertProduct);
router.put("/", updateProduct);
router.post("/search", searchProduct);

export default router;
