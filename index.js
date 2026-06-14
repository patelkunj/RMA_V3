import dotenv from "dotenv";
import pool from "./src/db/index.js";
import { app } from "./src/app.js";

dotenv.config({path: './.env'})

pool.connect((err,connection)=>{
  if(err) throw err;
  app.listen(process.env.PORT || 3000,()=>{
    console.log(`sever is running on port ${process.env.PORT}`);
  })
  console.log("PG database connected successfully");
  connection.release();
})