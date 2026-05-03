import mysql from "mysql2"
import dotenv from 'dotenv';
dotenv.config()

var pool = mysql.createPool({
  connectionLimit: 50,
  host: process.env.DATABASE_HOST,
  user: process.env.DATABASE_USER ,
  password: process.env.DATABASE_PASSWORD,
  database: process.env.DATABASE_NAME,
  multipleStatements: true,
});


pool.getConnection((err, connection) => {
  if (err) throw err;
  console.log("Database connected successfully");
  connection.release();
});

export default pool