import BaseModel from "./base-model.js";

class ProductModel extends BaseModel{
  constructor(){
    super('products')
  }
}

export {ProductModel}


// import pool from "../db/index.js"

// class ProductModel {
//   constructor() {
//     this.tableName = "products";
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

//   // add pagination for findAll
//   async findAll(limit, offset) {
//     const totalQuery = `SELECT COUNT(*) AS count FROM ${this.tableName}`;
//     const dataQuery = `SELECT * FROM ${this.tableName} LIMIT ? OFFSET ?`;

//     const result_totalQuery = await this.executeQuery(totalQuery);
//     const result = await this.executeQuery(dataQuery, [limit, offset]);
    
//     const total = result_totalQuery[0].count
//     const totalPages = Math.ceil(total / limit);

//    return {total,totalPages,result}
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

//   async search(searchTerm){
//     const fields = ['sku','product_name', 'model', 'status'];
//     const conditions = [];
//     const values = [];

//     if (searchTerm) {
//       for (const field of fields) {
//         conditions.push(`\`${field}\` LIKE ?`);
//         values.push(`%${searchTerm}%`);
//       }
//     }
//     const baseQuery = ` SELECT * FROM ${this.tableName}`;

//     const whereClause = conditions.length ? `WHERE ${conditions.join(' OR ')}` : '';
//     const finalQuery = `${baseQuery} ${whereClause}`;

//     const results = await this.executeQuery(finalQuery,values);
//     return results;

//   }


// }

// export {ProductModel}
