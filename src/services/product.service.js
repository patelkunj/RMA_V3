import prisma from "../db/prisma.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import {
    ensureUserCanAccessOrganization,
    getAssignedOrganizationIds,
    isSuperAdmin,
} from "../utils/accessControl.js";
import { safeServiceError } from "../utils/safeError.js";

const insertProduct = asyncHandler(async (req, res) => {
    try {

        const {
            sku,
            product_name,
            model,
            color,
            organizationId
        } = req.body;

        if (
            [sku, product_name, organizationId]
                .some(field => field?.toString().trim() === "")
        ) {
            throw new ApiError(400, "Required data is missing.");
        }

        await ensureUserCanAccessOrganization(req.user, organizationId);

        const existingProduct = await prisma.product.findFirst({
            where: {
                organizationId: Number(organizationId),
                sku: sku.trim()
            }
        });

        if (existingProduct) {
            throw new ApiError(
                400,
                "Product with this SKU already exists."
            );
        }

        const product = await prisma.product.create({
            data: {
                organizationId: Number(organizationId),
                sku: sku.trim(),
                name: product_name.trim(),
                model: model?.trim() || null,
                color: color?.trim() || null
            }
        });

        return res.status(201).json(
            new ApiResponse(
                201,
                product,
                "Product inserted successfully."
            )
        );

    } catch (error) {
        throw safeServiceError(error, "product.insert", "Unable to insert product.");
    }
});

const updateProduct = asyncHandler(async (req, res) => {
    try {

        const {
            id,
            sku,
            product_name,
            model,
            color,
            organizationId
        } = req.body;

        if (
            [id, sku, product_name, organizationId]
                .some(field => field?.toString().trim() === "")
        ) {
            throw new ApiError(400, "Required data is missing.");
        }

        await ensureUserCanAccessOrganization(req.user, organizationId);

        const existingProduct =
            await prisma.product.findUnique({
                where: {
                    id: Number(id)
                }
            });

        if (!existingProduct) {
            throw new ApiError(404, "Product not found.");
        }

        await ensureUserCanAccessOrganization(req.user, existingProduct.organizationId);

        const product = await prisma.product.update({
            where: {
                id: Number(id)
            },
            data: {
                organizationId: Number(organizationId),
                sku: sku.trim(),
                name: product_name.trim(),
                model: model?.trim() || null,
                color: color?.trim() || null
            }
        });

        return res.status(200).json(
            new ApiResponse(
                200,
                product,
                "Product updated successfully."
            )
        );

    } catch (error) {
        throw safeServiceError(error, "product.update", "Unable to update product.");
    }
});


const listProducts = asyncHandler(async (req, res) => {
    try {
        const page = Math.max(Number(req.query.page || req.body?.page) || 1, 1);
        const limit = Math.min(Math.max(Number(req.query.limit || req.body?.limit) || 50, 1), 100);
        const skip = (page - 1) * limit;

        const organizationIds = isSuperAdmin(req.user)
            ? []
            : await getAssignedOrganizationIds(req.user);

        const where = isSuperAdmin(req.user)
            ? {}
            : { organizationId: { in: organizationIds } };

        const [products, total] = await Promise.all([
            prisma.product.findMany({
                where,
                skip,
                take: limit,
                orderBy: {
                    name: "asc"
                }
            }),
            prisma.product.count({ where }),
        ]);

        return res.status(200).json(
            new ApiResponse(
                200,
                {
                    products,
                    total,
                    page,
                    limit,
                    totalPages: Math.ceil(total / limit),
                },
                "Product list"
            )
        );

    } catch (error) {

        throw safeServiceError(error, "product.list", "Unable to list products.");
    }
});

//Pagination version
const listAllProduct = asyncHandler(async (req, res) => {
    try {

        const page = Number(req.body.page) || 1;
        const limit = Number(req.body.limit) || 10;

        const skip = (page - 1) * limit;

        const [products, total] = await Promise.all([

            prisma.product.findMany({
                skip,
                take: limit,
                orderBy: {
                    id: "desc"
                }
            }),

            prisma.product.count()

        ]);

        return res.status(200).json(
            new ApiResponse(
                200,
                {
                    products,
                    total,
                    page,
                    limit,
                    totalPages: Math.ceil(total / limit)
                },
                "Product data"
            )
        );

    } catch (error) {

        throw safeServiceError(error, "product.list-all", "Unable to list products.");
    }
});

const searchProduct = asyncHandler(async (req, res) => {
    try {

        const { keyword } = req.body;

        if (!keyword?.trim()) {
            throw new ApiError(
                400,
                "Keyword is required."
            );
        }

        const organizationIds = isSuperAdmin(req.user)
            ? []
            : await getAssignedOrganizationIds(req.user);

        if (!isSuperAdmin(req.user) && organizationIds.length === 0) {
            return res.status(200).json(
                new ApiResponse(
                    200,
                    [],
                    "Product list"
                )
            );
        }

        const products = await prisma.product.findMany({
            where: {
                ...(isSuperAdmin(req.user) ? {} : { organizationId: { in: organizationIds } }),
                OR: [
                    {
                        sku: {
                            contains: keyword,
                            mode: "insensitive"
                        }
                    },
                    {
                        name: {
                            contains: keyword,
                            mode: "insensitive"
                        }
                    },
                    {
                        model: {
                            contains: keyword,
                            mode: "insensitive"
                        }
                    },
                    {
                        color: {
                            contains: keyword,
                            mode: "insensitive"
                        }
                    }
                ]
            },
            orderBy: {
                name: "asc"
            },
            take: 100,
        });

        return res.status(200).json(
            new ApiResponse(
                200,
                products,
                "Product list"
            )
        );

    } catch (error) {

        throw safeServiceError(error, "product.search", "Unable to search products.");
    }
});



export{
    listAllProduct,
    listProducts,
    insertProduct,
    updateProduct,
    searchProduct
}
