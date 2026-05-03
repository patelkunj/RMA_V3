import pool from "../db/index.js"
import BaseModel from "./base-model.js";
// import bcrypt from "bcrypt"
// import jwt from "jsonwebtoken"

class OrganizationModel extends BaseModel {
  constructor() {
    super("organizations")
  }

  // async search(searchTerm){
  //   const fields = ['name',' alias', 'email'];
  //   const conditions = [];
  //   const values = [];

  //   if (searchTerm) {
  //     for (const field of fields) {
  //       conditions.push(`\`${field}\` LIKE ?`);
  //       values.push(`%${searchTerm}%`);
  //     }
  //   }
  //   const baseQuery = ` SELECT * FROM ${this.tableName}`;

  //   const whereClause = conditions.length ? `WHERE ${conditions.join(' OR ')}` : '';
  //   const finalQuery = `${baseQuery} ${whereClause}`;

  //   const results = await this.executeQuery(finalQuery,values);
  //   return results;

  // }

}

export {OrganizationModel}
