import dotenv from "dotenv";
import pool from "./src/db/index.js";
import { app } from "./src/app.js";

dotenv.config({path: './.env'})

pool.getConnection((err, connection) => {
    if (err) throw err;
    app.listen(process.env.PORT || 3000, ()=>{
        console.log(`sever is running on port ${process.env.PORT}`);
    })
    console.log("Database connected successfully");
    connection.release();
});