import BaseModel from "./base-model.js";

class LogModel extends BaseModel{
  constructor(){
    super('system_logs')
  }
}

export {LogModel}

// import pool from "../db/index.js"
// // import bcrypt from "bcrypt"
// // import jwt from "jsonwebtoken"

// class LogModel {
//   constructor() {
//     this.tableName = "system_logs";
//   }

//   executeQuery(query, params) {
//     return new Promise((resolve, reject) => {
//       pool.query(query, params, (error, results) => {
//         if (error) {
//           reject(error);
//         } else {
//           resolve(results);
//         }
//       });
//     });
//   }

//   async create(data) {
//     const query = `INSERT INTO ${this.tableName} SET ?`;
//     const result = await this.executeQuery(query, data);
//     return result.insertId;
//   }

//   // Add pagination for find all
//   async findAll() {
//     const query = `SELECT * FROM ${this.tableName} where 1=1 `;
//     const results = await this.executeQuery(query);
//     return results;
//   }

// }

// export {LogModel}
