import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser"
import dotenv from 'dotenv';
dotenv.config()

const app = express();

// used of middleware
app.use(cors({
    origin:"http://localhost:5173",
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
app.use("/api/v1/proudcts",productRouter)
app.use("/api/v1/serialnumbers",serialNumberRouter)
app.use("/api/v1/organizations", organizationRouter)
app.use("/api/v1/chats", chatRouter)
app.use("/api/v1/comments", commentRouter)
app.use("/api/v1/repairjobcost",repairJobCostingRouter)
// app.use("/api/v1/videos",videoRouter)
// app.use("/api/v1/comments",commentRoute)
// app.use("/api/v1/tweets",tweetRoute)


export { app }