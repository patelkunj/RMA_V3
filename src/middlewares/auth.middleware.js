import { ApiError } from "../utils/ApiError.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import jwt from "jsonwebtoken";
import prisma from "../db/prisma.js";

export const verifyJWT = asyncHandler(async (req, res, next) => {
    try {
        const token =
            req.cookies?.accessToken ||
            req.headers["authorization"]?.replace("Bearer ", "");

        if (!token) {
            return res.status(401).json(new ApiError(401, "Unauthorized request"));
        }

        const decodedToken = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, {
            issuer: process.env.JWT_ISSUER || "rma-backend",
            audience: process.env.JWT_AUDIENCE || "rma-api",
        });

        const shouldTryUser = !decodedToken.actorType || decodedToken.actorType === "USER";
        const user = shouldTryUser ? await prisma.user.findUnique({
            where: {
                id: decodedToken?.id,
                email: decodedToken?.email,
            },
            select: {
                id: true,
                email: true,
                firstName:true,
                lastName: true,
                role:true,
                isActive: true,
                isLocked: true,
            },
        }) : null;

        if (user) {
            if (!user.isActive || user.isLocked) {
                return res.status(401).json(new ApiError(401, "Account is not active."));
            }

            delete user.isActive;
            delete user.isLocked;
            req.user = user;
            return next();
        }

        if (decodedToken.actorType && decodedToken.actorType !== "CUSTOMER") {
            return res.status(401).json(new ApiError(401, "Invalid Access Token"));
        }

        // Fall back to Customer for legacy tokens or use the explicit actor type.
        const customer = await prisma.customer.findFirst({
            where: {
                id: decodedToken?.id,
                email: decodedToken?.email,
            },
            select: {
                id: true,
                email: true,
                companyName:true,
                customerCode: true,
                organizationId: true,
                role: true,
                isActive: true,
                isLocked: true,
            },
        });

        if (!customer) {
            return res.status(401).json(new ApiError(401, "Invalid Access Token"));
        }

        if (!customer.isActive || customer.isLocked) {
            return res.status(401).json(new ApiError(401, "Account is not active."));
        }

        delete customer.isActive;
        delete customer.isLocked;
        req.customer = customer;
        return next();
    } catch (error) {
        return res
            .status(401)
            .json(new ApiError(401, "Invalid or expired access token"));
    }
});
