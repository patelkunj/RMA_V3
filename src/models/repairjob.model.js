import BaseModel from "./base-model.js";

class RepairJobModel extends BaseModel{
  constructor(){
    super('repair_jobs')
  }

  async lastrecord() {
      //const query = `SELECT id FROM ${this.tableName} ORDER BY ID DESC LIMIT 1;`;
        const results = await this.selectFields(["id"]).orderBy("id", "DESC").limit(1).execute();
;
        return results;
  }
}

export {RepairJobModel}

// import pool from "../db/index.js"

// class RepairJobModel {
//   constructor() {
//     this.tableName = "repair_jobs";
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

//   async update(id, data) {
//     const query = `UPDATE ${this.tableName} SET ? WHERE 1=1 and id = ?`;
//     const result = await this.executeQuery(query, [data, id]);
//     return result.affectedRows;
//   }

//   async delete(id) {
//     const query = `DELETE FROM ${this.tableName} WHERE 1=1 and id = ?`;
//     const result = await this.executeQuery(query, [id]);
//     return result.affectedRows;
//   }

//   async find(filters){
//     let query = `SELECT * FROM ${this.tableName} WHERE 1=1`;
//     const values = [];
  
//     // Advance filter (=) and IN()
//     if(filters){
//       for (const [key, value] of Object.entries(filters)) {
//         if (Array.isArray(value)) {
//           // Handle IN clause
//           const placeholders = value.map(() => '?').join(', ');
//           query += ` AND ${key} IN (${placeholders})`;
//           values.push(...value); // Spread array into values
//         }else if (typeof value === "string" && value.startsWith("!=")) {
//           // Quick shorthand: "!=5" or "!=someValue"
//           query += ` AND ${key} != ?`;
//           values.push(value.slice(2));
//         } else {
//           // Handle basic equality
//           query += ` AND ${key} = ?`;
//           values.push(value);
//         }
//       }
//     }
//     const results = await this.executeQuery(query, values);
//     if(results.length == 1 ){
//       return results[0]
//     }
//     return results;
//   }

//   async findById(id) {
//     const query = `SELECT * FROM ${this.tableName} WHERE 1=1 and id = ?`;
//     const results = await this.executeQuery(query, [id]);
//     return results[0];
//   }

//   async findAll(limit, offset) {
//     const totalQuery = `SELECT COUNT(*) AS count FROM ${this.tableName}`;
//     const dataQuery = `SELECT * FROM ${this.tableName} LIMIT ? OFFSET ?`;

//     const result_totalQuery = await this.executeQuery(totalQuery);
//     const result = await this.executeQuery(dataQuery, [limit, offset]);
    
//     const total = result_totalQuery[0].count
//     const totalPages = Math.ceil(total / limit);

//    return {total,totalPages,result}
//   }
  
//   async findByJoin(table, condition, type, field) {

//     if(type == "left") type = " LEFT JOIN "
//     if(type == "right") type = " RIGHT JOIN "
//     if(type == "inner") type = " INNER JOIN "

//     if(field == '' || field == undefined || field == null ) field = '*'

//     const query = `SELECT ${field} FROM ${this.tableName} ${type} ${table} ON 1=1 and is_active = 1 and is_locked = 0 and ${condition}`;
//     const results = await this.executeQuery(query);
//     return results[0];
//   }
  
//   async search(searchTerm){
//     const fields = ['id', 'ra_job_id' ,'product_name', 'serial_number', 'company_job_no', 'sku', 'sales_invoice'];
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

//   async lastrecord() {
//     const query = `SELECT id FROM ${this.tableName} ORDER BY ID DESC LIMIT 1;`;
//     const results = await this.executeQuery(query);
//     return results[0];
//   }

//   // async findByField(field) {
//   //   const query = `SELECT * FROM ${this.tableName} WHERE 1=1 and ${field}`;
//   //   const results = await this.executeQuery(query);
//   //   return results;
//   // }

// }

// export {RepairJobModel}
