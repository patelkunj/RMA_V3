import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import dotenv from "dotenv";
import { ApiError } from "./utils/ApiError.js";
import { securityHeaders } from "./middlewares/security.middleware.js";
import { apiRateLimit } from "./middlewares/rateLimit.middleware.js";
import { activityLogger } from "./middlewares/activityLogger.middleware.js";
import { logger } from "./utils/logger.js";
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

app.use(cors({
    origin(origin, callback) {
        if (!origin || allowedOrigins.includes(origin)) {
            return callback(null, true);
        }
        return callback(new ApiError(403, "CORS origin is not allowed"));
    },
    credentials: true
}));

app.use(apiRateLimit);
app.use(express.json({ limit: "16kb" }));
app.use(express.urlencoded({ extended: true, limit: "16kb" }));
app.use(express.static("public", {
    dotfiles: "deny",
    index: false,
    maxAge: process.env.NODE_ENV === "production" ? "1d" : 0,
}));
app.use(cookieParser());


//routes
import userRouter from "./routes/user.routes.js";
import customerRouter from "./routes/customer.routes.js";
import repairJobRouter from "./routes/repairjob.routes.js";
import productRouter from "./routes/product.routes.js";
import serialNumberRouter from "./routes/serialnumber.routes.js";
import organizationRouter from "./routes/organization.routes.js";
import chatRouter from "./routes/chat.routers.js";
import commentRouter from "./routes/comment.routers.js";
import repairJobCostingRouter from "./routes/repairjobcost.routes.js";
import reportRouter from "./routes/report.routes.js";

app.use("/api/v1/users", userRouter);
app.use("/api/v1/customers", customerRouter);
app.use("/api/v1/repairjobs", repairJobRouter);
app.use("/api/v1/products", productRouter);
app.use("/api/v1/proudcts", productRouter); // Legacy misspelled alias.
app.use("/api/v1/serialnumbers", serialNumberRouter);
app.use("/api/v1/organizations", organizationRouter);
app.use("/api/v1/chats", chatRouter);
app.use("/api/v1/comments", commentRouter);
app.use("/api/v1/repairjobcost", repairJobCostingRouter);
app.use("/api/v1/reports", reportRouter);

app.use((req, res) => {
    return res.status(404).json(new ApiError(404, "Route not found"));
});

app.use((err, req, res, next) => {
    const statusCode = err?.statusCode || 500;
    const message = statusCode === 500 && process.env.NODE_ENV === "production"
        ? "Internal Server Error"
        : err?.message || "Internal Server Error";

    logger.error("request_error", {
        requestId: req.id,
        method: req.method,
        path: req.originalUrl || req.url,
        statusCode,
        error: err,
    });

    return res.status(statusCode).json({
        success: false,
        statusCode,
        message,
        errors: err?.errors || [],
    });
});


export { app };
