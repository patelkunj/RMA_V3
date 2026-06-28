import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser"
import dotenv from 'dotenv';
import { ApiError } from "./utils/ApiError.js";
dotenv.config()

const app = express();

// used of middleware
const allowedOrigins = (process.env.CORS_ORIGIN || "http://localhost:5173")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);

app.use(cors({
    origin(origin, callback) {
        if (!origin || allowedOrigins.includes(origin)) {
            return callback(null, true);
        }
        return callback(new ApiError(403, "CORS origin is not allowed"));
    },
    credentials: true
}));

app.use(express.json({limit:"16kb"}))
app.use(express.urlencoded({extended:true, limit:"16kb"}))
app.use(express.static("public"))
app.use(cookieParser()) // for access the Cookies value


//routes
import userRouter from "./routes/user.routes.js";
import customerRouter from "./routes/customer.routes.js"
import repairJobRouter from "./routes/repairjob.routes.js"
import productRouter from "./routes/product.routes.js"
import serialNumberRouter from "./routes/serialnumber.routes.js"
import organizationRouter from "./routes/organization.routes.js"
import chatRouter from "./routes/chat.routers.js"
import commentRouter from "./routes/comment.routers.js"
import repairJobCostingRouter from "./routes/repairjobcost.routes.js"
// import videoRouter from "./routes/video.routes.js";
// import commentRoute from "./routes/comment.routes.js"
// import tweetRoute from "./routes/tweet.routes.js"

//routes define
app.use("/api/v1/users",userRouter)
app.use("/api/v1/customers", customerRouter)
app.use("/api/v1/repairjobs", repairJobRouter)
app.use("/api/v1/products",productRouter)
app.use("/api/v1/proudcts",productRouter)
app.use("/api/v1/serialnumbers",serialNumberRouter)
app.use("/api/v1/organizations", organizationRouter)
app.use("/api/v1/chats", chatRouter)
app.use("/api/v1/comments", commentRouter)
app.use("/api/v1/repairjobcost",repairJobCostingRouter)
// app.use("/api/v1/videos",videoRouter)
// app.use("/api/v1/comments",commentRoute)
// app.use("/api/v1/tweets",tweetRoute)

app.use((err, req, res, next) => {
    const statusCode = err?.statusCode || 500;
    const message = statusCode === 500 && process.env.NODE_ENV === "production"
        ? "Internal Server Error"
        : err?.message || "Internal Server Error";

    return res.status(statusCode).json({
        success: false,
        statusCode,
        message,
        errors: err?.errors || [],
    });
});


export { app }
