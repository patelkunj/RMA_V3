import dotenv from "dotenv";
import pool from "./src/db/index.js";
import { app } from "./src/app.js";

dotenv.config({path: './.env'})

pool.connect((err,connection)=>{
  if(err) {
    console.error("PG database connection failed", err);
    process.exit(1);
  }

  const port = process.env.PORT || 3000;
  app.listen(port,()=>{
    console.log(`server is running on port ${port}`);
  })
  console.log("PG database connected successfully");
  connection.release();
})
