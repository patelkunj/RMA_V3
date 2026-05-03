import BaseModel from "./base-model.js"

class SessionModel extends BaseModel{
  constructor(){
    super('session_managements')
  }
}
export {SessionModel}

// import pool from "../db/index.js"

// class SessionModel {
//   constructor() {
//     this.tableName = "session_managements";
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

//   async find(filters){
//     let query = `SELECT * FROM ${this.tableName} WHERE 1=1`;
//     const values = [];
  
//     // Basic filters (=)
//     if(filters){
//       for (const [key, value] of Object.entries(filters)) {
//         query += ` AND ${key} = ?`;
//         values.push(value);
//       }
//     }

//     const results = await this.executeQuery(query, values);
//     return results;
//     //return { query, values };

//   }

//   // Add pagination for findAll
//   async findAll() {
//     const query = `SELECT * FROM ${this.tableName} where 1=1 `;
//     const results = await this.executeQuery(query);
//     return results;
//   }

//   async findById(id) {
//     const query = `SELECT * FROM ${this.tableName} WHERE 1=1 and id = ?`;
//     const results = await this.executeQuery(query, [id]);
//     return results[0];
//   }

//   async findByField(field) {
//     const query = `SELECT * FROM ${this.tableName} WHERE 1=1 and ${field}`;
//     const results = await this.executeQuery(query);
//     return results[0];
//   }

//   async create(data) {
//     const query = `INSERT INTO ${this.tableName} SET ?`;
//     const result = await this.executeQuery(query, data);
//     return result.insertId;
//   }

//   async update(id, data) {
//     const query = `UPDATE ${this.tableName} SET ? WHERE 1=1 and id = ?`;
//     const result = await this.executeQuery(query, [data, id]);
//     return result.affectedRows;
//   }

// }

// export {SessionModel}
