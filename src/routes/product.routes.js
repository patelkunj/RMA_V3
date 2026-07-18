import { Router } from "express";
import { verifyJWT } from "../middlewares/auth.middleware.js";
import { authorizeRoles } from "../middlewares/authorisation.middleware.js";
import { deprecateRoute } from "../middlewares/deprecation.middleware.js";
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
router.get("/search", searchProduct);

router.post("/search", deprecateRoute((req) => {
    const keyword = req.body?.keyword ? `?keyword=${encodeURIComponent(req.body.keyword)}` : "";
    return `/api/v1/products/search${keyword}`;
}), searchProduct);
router.put("/", deprecateRoute((req) => `/api/v1/products/${req.body?.id || "{id}"}`), updateProduct);

router.put("/:id", updateProduct);

export default router;
