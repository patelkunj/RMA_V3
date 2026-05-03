import BaseModel from "./base-model.js";

class ProductSerialsModel extends BaseModel{
  constructor(){
    super('product_serials')
  }
}

export {ProductSerialsModel}



// import pool from "../db/index.js"

// class SerialNumberModel {
//   constructor() {
//     this.tableName = "serial_numbers";
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

//   // add Pagination for findAll
//   async findAll(limit, offset) {
//     const totalQuery = `SELECT COUNT(*) AS count FROM ${this.tableName}`;
//     const dataQuery = `SELECT * FROM ${this.tableName} LIMIT ? OFFSET ?`;

//     const result_totalQuery = await this.executeQuery(totalQuery);
//     const result = await this.executeQuery(dataQuery, [limit, offset]);
    
//     const total = result_totalQuery[0].count
//     const totalPages = Math.ceil(total / limit);

//    return {total,totalPages,result}
//   }

//   async findById(id) {
//     const query = `SELECT * FROM ${this.tableName} WHERE 1=1 and id = ?`;
//     const results = await this.executeQuery(query, [id]);
//     return results[0];
//   }

//   // async findByField(field) {
//   //   const query = `SELECT * FROM ${this.tableName} WHERE 1=1 and ${field}`;
//   //   const results = await this.executeQuery(query);
//   //   return results[0];
//   // }


//   async findByJoin(table, condition, type, field) {

//     if(type == "left") type = " LEFT JOIN "
//     if(type == "right") type = " RIGHT JOIN "
//     if(type == "inner") type = " INNER JOIN "

//     if(field == '' || field == undefined || field == null ) field = '*'

//     const query = `SELECT ${field} FROM ${this.tableName} ${type} ${table} ON 1=1 and is_active = 1 and is_locked = 0 and ${condition}`;
//     const results = await this.executeQuery(query);
//     return results[0];
//   }

//   async findWithPagination(limit, offset){

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

//   async delete(id) {
//     const query = `DELETE FROM ${this.tableName} WHERE 1=1 and id = ?`;
//     const result = await this.executeQuery(query, [id]);
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


//   async buildSelectQuery(filters,pagination, sort,like,range,inList) {
      
//     let query = `SELECT * FROM ${this.tableName} WHERE 1=1`;
//     const values = [];
  
//     // Basic filters (=)
//     if(filters){
//       for (const [key, value] of Object.entries(filters)) {
//         query += ` AND ${key} = ?`;
//         values.push(value);
//       }
//     }
    
  
//     // LIKE filters
//     if(like){
//       for (const [key, pattern] of Object.entries(like)) {
//         query += ` AND ${key} LIKE ?`;
//         values.push(`%${pattern}%`);
//       }
//     }
    
  
//     // Range filters
//     if(range){
//       for (const [key, condition] of Object.entries(range)) {
//         const { operator, value } = condition;
//         if (['>', '<', '>=', '<='].includes(operator)) {
//           query += ` AND ${key} ${operator} ?`;
//           values.push(value);
//         }
//       }
//     }
    
  
//     // IN filters
//     if(inList){
//       for (const [key, list] of Object.entries(inList)) {
//         if (Array.isArray(list) && list.length > 0) {
//           const placeholders = list.map(() => '?').join(', ');
//           query += ` AND ${key} IN (${placeholders})`;
//           values.push(...list);
//         }
//       }
//     }
    
  
//     // Sorting
//     if(sort){
//       for (const [key, value] of Object.entries(sort)) {
//         query += ` ORDER BY ${key} ${value.toUpperCase()}`;
//       }

//     }
  
//     // Pagination
//     if(pagination){
//       if (pagination.limit) {
//         query += ` LIMIT ?`;
//         values.push(Number(pagination.limit));
//         if (pagination.offset) {
//           query += ` OFFSET ?`;
//           values.push(Number(pagination.offset));
//         }
//       }
//     }
    
  
//     const results = await this.executeQuery(query, values);
//     return results;
//     //return { query, values };

//   }

//   async bulkInsert(data = []) {
//     if (!Array.isArray(data) || data.length === 0) {
//       throw new Error("Data must be a non-empty array of objects.");
//     }
  
//     const columns = Object.keys(data[0]);
//     const placeholders = data.map(() => `(${columns.map(() => '?').join(', ')})`).join(', ');
//     const values = data.flatMap(row => columns.map(col => row[col]));
  
//     const query = `INSERT INTO ${this.tableName} (${columns.join(', ')}) VALUES ${placeholders}`;
  
//     const result = await this.executeQuery(query,values)
//     return result.insertId;
//   }


// }

// export {SerialNumberModel}
