import { Pool } from "pg";
import dotenv from 'dotenv';
dotenv.config()

const pool = new Pool({
  host: process.env.DATABASE_HOST,
  user: process.env.DATABASE_USER,
  password:process.env.DATABASE_PASSWORD,
  database:process.env.DATABASE_NAME,
  max: 50,
  idleTimeoutMillis: 30000,
})

pool.connect((err,connection)=>{
  if(err) throw err;
  console.log("PG database connected successfully");
  connection.release();
})

export default pool;