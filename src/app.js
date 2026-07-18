import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import dotenv from "dotenv";
import { ApiError } from "./utils/ApiError.js";
import { securityHeaders } from "./middlewares/security.middleware.js";
import { apiRateLimit } from "./middlewares/rateLimit.middleware.js";
import { activityLogger } from "./middlewares/activityLogger.middleware.js";
import { logger } from "./utils/logger.js";
import { metricsMiddleware } from "./utils/metrics.js";
import operationalRouter from "./routes/operational.routes.js";
import { verifyCsrf } from "./middlewares/csrf.middleware.js";
import openapiRouter from "./routes/openapi.routes.js";
import { sanitizeRequestPath } from "./utils/requestSanitizer.js";
import { deprecateRoute, replacePathPrefix } from "./middlewares/deprecation.middleware.js";
dotenv.config();

const app = express();
app.disable("x-powered-by");

if (process.env.TRUST_PROXY === "true") {
    app.set("trust proxy", 1);
}

// used of middleware
const allowedOrigins = (process.env.CORS_ORIGIN || "http://localhost:5173")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);

app.use(securityHeaders);
app.use(activityLogger);
app.use(metricsMiddleware);

app.use(cors({
    origin(origin, callback) {
        if (!origin || allowedOrigins.includes(origin)) {
            return callback(null, true);
        }
        return callback(new ApiError(403, "CORS origin is not allowed"));
    },
    credentials: true
}));

app.use(express.json({ limit: "16kb" }));
app.use(express.urlencoded({ extended: true, limit: "16kb" }));
app.use(cookieParser());
app.use(verifyCsrf);
app.use(operationalRouter);
app.use("/api-docs", openapiRouter);
app.use(apiRateLimit);


//routes
import userRouter from "./routes/user.routes.js";
import customerRouter from "./routes/customer.routes.js";
import repairJobRouter from "./routes/repair-job.routes.js";
import productRouter from "./routes/product.routes.js";
import serialNumberRouter from "./routes/serial-number.routes.js";
import organizationRouter from "./routes/organization.routes.js";
import chatRouter from "./routes/chat.routes.js";
import commentRouter from "./routes/comment.routes.js";
import repairJobCostingRouter from "./routes/repair-job-costs.routes.js";
import reportRouter from "./routes/report.routes.js";
import notificationRouter from "./routes/notification.routes.js";
import documentRouter from "./routes/document.routes.js";
import repairJobTimelineRouter from "./routes/repair-job-timeline.routes.js";
import sessionRouter from "./routes/session.routes.js";
import inventoryRouter from "./routes/inventory.routes.js";
import logisticsRouter from "./routes/logistics.routes.js";
import billingRouter from "./routes/billing.routes.js";
import organizationSettingsRouter from "./routes/organization-settings.routes.js";
import integrationRouter from "./routes/integration.routes.js";
import privacyRouter from "./routes/privacy.routes.js";
import mfaRouter from "./routes/mfa.routes.js";

app.use("/api/v1/users", userRouter);
app.use("/api/v1/customers", customerRouter);
app.use("/api/v1/repair-jobs", repairJobRouter);
app.use(
    "/api/v1/repairjobs",
    deprecateRoute(replacePathPrefix("/api/v1/repairjobs", "/api/v1/repair-jobs")),
    repairJobRouter,
);
app.use("/api/v1/products", productRouter);
app.use(
    "/api/v1/proudcts",
    deprecateRoute(replacePathPrefix("/api/v1/proudcts", "/api/v1/products")),
    productRouter,
);
app.use("/api/v1/serial-numbers", serialNumberRouter);
app.use(
    "/api/v1/serialnumbers",
    deprecateRoute(replacePathPrefix("/api/v1/serialnumbers", "/api/v1/serial-numbers")),
    serialNumberRouter,
);
app.use("/api/v1/organizations", organizationRouter);
app.use("/api/v1/chats", chatRouter);
app.use("/api/v1/comments", commentRouter);
app.use("/api/v1/repair-job-costs", repairJobCostingRouter);
app.use(
    "/api/v1/repairjobcost",
    deprecateRoute(replacePathPrefix("/api/v1/repairjobcost", "/api/v1/repair-job-costs")),
    repairJobCostingRouter,
);
app.use("/api/v1/reports", reportRouter);
app.use("/api/v1/notifications", notificationRouter);
app.use("/api/v1/documents", documentRouter);
app.use("/api/v1/repair-job-timeline", repairJobTimelineRouter);
app.use(
    "/api/v1/repairjob-timeline",
    deprecateRoute(replacePathPrefix("/api/v1/repairjob-timeline", "/api/v1/repair-job-timeline")),
    repairJobTimelineRouter,
);
app.use("/api/v1/sessions", sessionRouter);
app.use("/api/v1/inventory", inventoryRouter);
app.use("/api/v1/shipments", logisticsRouter);
app.use("/api/v1/billing", billingRouter);
app.use("/api/v1/organization-settings", organizationSettingsRouter);
app.use("/api/v1/integrations", integrationRouter);
app.use("/api/v1/privacy", privacyRouter);
app.use("/api/v1/mfa", mfaRouter);

app.use((req, res) => {
    return res.status(404).json(new ApiError(404, "Route not found"));
});

const errorHandler = (err, req, res, next) => {
    if (res.headersSent) return next(err);

    const errorStatus = err?.statusCode ?? err?.status;
    const statusCode = Number.isInteger(errorStatus) && errorStatus >= 400 && errorStatus <= 599
        ? errorStatus
        : 500;
    const message = err instanceof ApiError
        ? err.message
        : statusCode === 400
            ? "Invalid request."
            : statusCode === 413
                ? "Request payload is too large."
                : statusCode >= 500
                    ? "Internal Server Error"
                    : "Request failed.";
    const errors = Array.isArray(err?.errors) ? err.errors : [];

    logger.error("request_error", {
        requestId: req.id,
        method: req.method,
        path: sanitizeRequestPath(req.originalUrl || req.url),
        statusCode,
        error: err,
    });

    return res.status(statusCode).json({
        statusCode,
        data: null,
        message,
        success: false,
        errors,
    });
};

app.use(errorHandler);


export { app, errorHandler };
