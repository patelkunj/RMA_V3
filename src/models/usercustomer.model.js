// models/UserModel.js
import BaseModel from "./base-model.js";

class UserCustomerModel extends BaseModel {
  constructor() {
    super('user_customers');
  }

  async insertMany(userId,customerId) {
    if (!Array.isArray(customerId) || customerId.length === 0) {
      throw new Error('customerId array must contain at least one record.');
    }

    const dataSet=[];

    customerId.forEach((c) =>{
      dataSet.push({user_id:userId, customer_id:c}) 
    })

    const result = await this.createMany(dataSet)

    return result;
  }

  async updateMany(userId,customerId) {
    if (!Array.isArray(customerId) || customerId.length === 0) {
      throw new Error('customerId array must contain at least one record.');
    }

    const dataSet=[];

    customerId.forEach((c) =>{
      dataSet.push({user_id:userId, customer_id:c}) 
    })

    const deleteData = await this.delete({'user_id':userId})
    if(!deleteData){
      return null
    }

    const result = await this.createMany(dataSet)

    return result;
  }

}

export {UserCustomerModel}








// import pool from "../db/index.js"
// import bcrypt from "bcrypt"
// import { generateAccessToken, generateRefreshToken } from "../utils/toeknHandler.js";
// import BaseModel from "./demo.model.js";

// class UserModel extends BaseModel {
  
//   super(){
//     this.tableName="users";
//   }


//   async find(filters, excludeFields = []) {
//     try {
//       const findData = await this.find(filters, excludeFields = [])
//       return findData

//     } catch (error) {
      
//     }
//   }




//   // constructor() {
//   //   this.tableName = "users";
//   // }
//   // executeQuery(query, params) {
//   //   return new Promise((resolve, reject) => {
//   //     pool.query(query, params, (error, results) => {
//   //       if (error) {
//   //         reject(error);
//   //       } else {
//   //         resolve(results);
//   //       }
//   //     });
//   //   });
//   // }

//   // async find(filters, excludeFields = []) {

//   //   try {
//   //     let query = `SELECT * FROM ${this.tableName} WHERE 1=1`;
//   //       const values = [];
      
//   //       // Apply filters
//   //       if (filters) {
//   //         for (const [key, value] of Object.entries(filters)) {
//   //           query += ` AND ${key} = ?`;
//   //           values.push(value);
//   //         }
//   //       }
      
//   //       const results = await this.executeQuery(query, values);
      
//   //       // Dynamically remove excluded fields from each row
//   //       const sanitizedResults = results.map(row => {
//   //         const sanitizedRow = { ...row };
//   //         for (const field of excludeFields) {
//   //           delete sanitizedRow[field];
//   //         }
//   //         return sanitizedRow;
//   //       });
      
//   //       if(sanitizedResults.length > 1){
//   //         return sanitizedResults;
//   //       }
//   //       return sanitizedResults[0];
       
      
//   //   } catch (error) {
//   //      return null;
//   //   }

//   // }

//   // // add Pagination for findAll
//   // async findAll(limit, offset, excludeFields = []) {
//   //   const totalQuery = `SELECT COUNT(*) AS count FROM ${this.tableName}`;
//   //   const dataQuery = `SELECT * FROM ${this.tableName} LIMIT ? OFFSET ?`;

//   //   const result_totalQuery = await this.executeQuery(totalQuery);
//   //   const results = await this.executeQuery(dataQuery, [limit, offset]);

//   //   // Dynamically remove excluded fields from each row
//   //   const sanitizedResults = results.map(row => {
//   //     const sanitizedRow = { ...row };
//   //     for (const field of excludeFields) {
//   //       delete sanitizedRow[field];
//   //     }
//   //     return sanitizedRow;
//   //   });

    
//   //   const total = result_totalQuery[0].count
//   //   const totalPages = Math.ceil(total / limit);

//   //  return {total,totalPages,sanitizedResults}
//   // }

//   // async findById(id) {
//   //   const query = `SELECT * FROM ${this.tableName} WHERE 1=1 and id = ?`;
//   //   const results = await this.executeQuery(query, [id]);
//   //   return results[0];
//   // }

//   // async findByJoin(table, condition, type, field) {

//   //   if(type == "left") type = " LEFT JOIN "
//   //   if(type == "right") type = " RIGHT JOIN "
//   //   if(type == "inner") type = " INNER JOIN "

//   //   if(field == '' || field == undefined || field == null ) field = '*'

//   //   const query = `SELECT ${field} FROM ${this.tableName} ${type} ${table} ON 1=1 and ${this.tableName}.is_active = 1 and is_locked = 0 and ${condition}`;
//   //   const results = await this.executeQuery(query);
//   //   return results[0];
//   // }

//   // async create(data) {
//   //   const query = `INSERT INTO ${this.tableName} SET ?`;
//   //   const result = await this.executeQuery(query, data);
//   //   return result.insertId;
//   // }

//   // async update(id, data) {
//   //   const query = `UPDATE ${this.tableName} SET ? WHERE 1=1 and id = ?`;
//   //   const result = await this.executeQuery(query, [data, id]);
//   //   return result.affectedRows;
//   // }

//   // async delete(id) {
//   //   const query = `DELETE FROM ${this.tableName} WHERE 1=1 and id = ?`;
//   //   const result = await this.executeQuery(query, [id]);
//   //   return result.affectedRows;
//   // }

//   // async isPasswordCorrect(userpassword, databasepassword) {
//   //   const result =  await bcrypt.compare(userpassword,databasepassword);
//   //   return result;
//   // }

//   // //your_column = CONCAT(your_column, ' - additional text')
//   // async assignStore(data) {
//   //   const query = `UPDATE ${this.tableName} SET assigned_customer_id= CONCAT(assigned_customer_id,?) WHERE 1=1 and assign_type='full'`;
//   //   console.log(query)
//   //   const result = await this.executeQuery(query, data);
//   //   return result.affectedRows;
//   // }

//   // async search(searchTerm){
//   //   const fields = ['first_name','last_name', 'email','mobile'];
//   //   const conditions = [];
//   //   const values = [];

//   //   if (searchTerm) {
//   //     for (const field of fields) {
//   //       conditions.push(`\`${field}\` LIKE ?`);
//   //       values.push(`%${searchTerm}%`);
//   //     }
//   //   }
//   //   const baseQuery = ` SELECT * FROM ${this.tableName}`;

//   //   const whereClause = conditions.length ? `WHERE ${conditions.join(' OR ')}` : '';
//   //   const finalQuery = `${baseQuery} ${whereClause}`;

//   //   const results = await this.executeQuery(finalQuery,values);
//   //   return results;

//   // }

//   // async generateAccessToken(user){
//   //   const accessToken  =  await jwt.sign(
//   //     {
//   //         id:user.id,
//   //         email:user.email,
//   //         username:user.emp_user_id
//   //     },
//   //     process.env.ACCESS_TOKEN_SECRET,
//   //     {
//   //         expiresIn: process.env.ACCESS_TOKEN_EXPIRY
//   //     }
//   //   )
//   //   return accessToken
//   // }

//   // async generateRefreshToken(user){

//   //   const refreshToken = await jwt.sign(
//   //       {
//   //           id:user.id
//   //       },
//   //       process.env.REFRESH_TOKEN_SECRET,
//   //       {
//   //           expiresIn: process.env.REFRESH_TOKEN_EXPIRY
//   //       }
//   //   )
//   //   return refreshToken

//   // }
// }

// export {UserModel}
