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

export default pool;
