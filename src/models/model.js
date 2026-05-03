import pool from "../db/index.js";

export default class BaseModel {
  constructor(tableName, state = null) {
    this.tableName = tableName;

    // Immutable state container
    this.state = state || {
      joins: [],
      wheres: [],
      excludeFields: [],
      order: "",
      limit: "",
      selectFields: null,
    };
  }

  // ---- INTERNAL: RETURN A CLONED NEW MODEL WITH UPDATED STATE ----
  clone(patch = {}) {
    return new BaseModel(this.tableName, {
      ...this.state,
      ...patch,
    });
  }

  // ---- SQL EXECUTOR ----
  executeQuery(sql, values = []) {
    return new Promise((resolve, reject) => {
      pool.query(sql, values, (err, results) => {
        if (err) return reject(err);
        resolve(results);
      });
    });
  }

  // ---------------- CRUD ----------------------

  async create(data) {
    const sql = `INSERT INTO \`${this.tableName}\` SET ?`;
    const res = await this.executeQuery(sql, data);
    return res.insertId ?? res;
  }

  async createMany(dataArray = []) {
    if (!Array.isArray(dataArray) || dataArray.length === 0) {
      throw new Error("Data array must contain at least one record.");
    }

    const keys = Object.keys(dataArray[0]);
    const placeholders = dataArray
      .map(() => `(${keys.map(() => '?').join(',')})`)
      .join(',');

    const values = dataArray.flatMap(obj => keys.map(k => obj[k]));

    const sql = `INSERT INTO \`${this.tableName}\` (${keys.join(',')}) VALUES ${placeholders}`;
    const result = await this.executeQuery(sql, values);

    return {
      insertedCount: result.affectedRows,
      firstInsertId: result.insertId,
    };
  }

  async update(filter = {}, update = {}) {
    const whereKeys = Object.keys(filter);
    const updateKeys = Object.keys(update);

    if (whereKeys.length === 0) throw new Error("Empty filter object.");
    if (updateKeys.length === 0) throw new Error("Empty update object.");

    const whereSql = whereKeys.map(k => `\`${k}\` = ?`).join(" AND ");
    const setSql = updateKeys.map(k => `\`${k}\` = ?`).join(", ");

    const sql = `
      UPDATE \`${this.tableName}\`
      SET ${setSql}
      WHERE ${whereSql}
    `.trim();

    const result = await this.executeQuery(sql, [
      ...Object.values(update),
      ...Object.values(filter),
    ]);

    return {
      matched: result.affectedRows || 0,
      modified: result.changedRows ?? result.affectedRows ?? 0
    };
  }

  async delete(filter = {}) {
    const keys = Object.keys(filter);
    if (keys.length === 0) throw new Error("Empty filter object.");

    const whereSql = keys.map(k => `\`${k}\` = ?`).join(" AND ");
    const sql = `DELETE FROM \`${this.tableName}\` WHERE ${whereSql}`;

    const result = await this.executeQuery(sql, Object.values(filter));
    return result?.affectedRows ?? result;
  }

  async count(filter = {}) {
    let sql = `SELECT COUNT(*) AS total FROM \`${this.tableName}\``;
    let values = [];

    if (Object.keys(filter).length) {
      const whereSql = Object.keys(filter)
        .map(k => `\`${k}\` = ?`)
        .join(" AND ");

      values = Object.values(filter);
      sql += ` WHERE ${whereSql}`;
    }

    const res = await this.executeQuery(sql, values);
    return res[0]?.total ?? 0;
  }

  // ---------------- FIND CHAIN ----------------------

  // find(filters = {}, excludeFields = []) {
  //   const wheres = [];

  //   for (const [key, value] of Object.entries(filters)) {
  //     if (key.endsWith("_not")) {
  //       wheres.push({ sql: `\`${key.replace("_not", "")}\` != ?`, values: [value] });

  //     } else if (key.endsWith("_like")) {
  //       wheres.push({ sql: `\`${key.replace("_like", "")}\` LIKE ?`, values: [`%${value}%`] });

  //     } else if (Array.isArray(value)) {
  //       const ph = value.map(() => "?").join(", ");
  //       wheres.push({ sql: `\`${key}\` IN (${ph})`, values: value });

  //     } else {
  //       wheres.push({ sql: `\`${key}\` = ?`, values: [value] });
  //     }
  //   }

  //   return this.clone({
  //     excludeFields,
  //     wheres,
  //   });
  // }


  find(filters = {}, excludeFields = []) {
  const wheres = [];

  for (const [key, value] of Object.entries(filters)) {
    if (value === undefined || value === null) continue; // ignore null filters

    let field = key;
    let operator = "=";

    // ---- OPERATOR PARSING ---- //
    const opSuffixes = [
      "_like",
      "_in",
      "_between",
      "_is_null",
      "_not_null"
    ];

    for (const suffix of opSuffixes) {
      if (key.endsWith(suffix)) {
        field = key.replace(suffix, "");
        operator = suffix;
        break;
      }
    }

    const safeField = `\`${field}\``;

    // ---- OPERATOR HANDLING ---- //

    switch (operator) {

      case "_like":
        wheres.push({ sql: `${safeField} LIKE ?`, values: [`%${value}%`] });
        break;

      case "_in":
        if (!Array.isArray(value) || value.length === 0) break;
        wheres.push({
          sql: `${safeField} IN (${value.map(() => "?").join(", ")})`,
          values: value
        });
        break;

      case "_between":
        if (!Array.isArray(value) || value.length !== 2) {
          throw new Error(`Invalid between filter for ${field}`);
        }
        wheres.push({
          sql: `${safeField} BETWEEN ? AND ?`,
          values: [value[0], value[1]]
        });
        break;

      case "_is_null":
        wheres.push({ sql: `${safeField} IS NULL`, values: [] });
        break;

      case "_not_null":
        wheres.push({ sql: `${safeField} IS NOT NULL`, values: [] });
        break;

      default:
        // standard =
        wheres.push({ sql: `${safeField} = ?`, values: [value] });
        break;
    }
  }

  return this.clone({
    excludeFields,
    wheres
  });
}


  selectFields(fields = []) {
    return this.clone({ selectFields: fields });
  }

  join(table, condition, type = "left") {
    const join = `${type.toUpperCase()} JOIN ${table} ON ${condition}`;
    return this.clone({ joins: [...this.state.joins, join] });
  }

  orderBy(column, direction = "ASC") {
    return this.clone({
      order: `ORDER BY ${column} ${direction.toUpperCase()}`,
    });
  }

  limit(n) {
    return this.clone({
      limit: `LIMIT ${n}`,
    });
  }

  // ---------------- EXECUTE FINAL QUERY ----------------------

  async execute() {
  const state = this.state;

  // ---- MAIN TABLE COLUMNS ----
  const mainSelect = [`\`${this.tableName}\`.*`];

  // ---- JOIN TABLE COLUMNS WITH ALIAS ----
  const joinSelects = [];

  for (const j of state.joins) {
    if (Array.isArray(j.select)) {
      for (const col of j.select) {
        if (col === "id") {
          joinSelects.push(`\`${j.alias}\`.id AS ${j.alias}_id`);
        } else {
          joinSelects.push(`\`${j.alias}\`.\`${col}\` AS ${j.alias}_${col}`);
        }
      }
    }
  }

  const selectSql = `
    SELECT ${[...mainSelect, ...joinSelects].join(", ")}
    FROM \`${this.tableName}\`
  `;

  const joinSql = state.joins.length
    ? " " + state.joins.map(j => j.joinSql).join(" ")
    : "";

  const whereSql = state.wheres.length
    ? " WHERE " + state.wheres.map(w => w.sql).join(" AND ")
    : "";

  const values = state.wheres.flatMap(w => w.values);

  const sql = `${selectSql}${joinSql}${whereSql} ${state.order} ${state.limit}`.trim();

  const rows = await this.executeQuery(sql, values);

  if (!Array.isArray(rows) || rows.length === 0) return null;
  if (rows.length === 1) return rows[0];
  return rows;
}




  // async execute() {
  //   const state = this.state;

  //   let selectSql = `SELECT * FROM \`${this.tableName}\``;

  //   const joinSql = state.joins.length ? " " + state.joins.join(" ") : "";

  //   const whereSql = state.wheres.length
  //     ? " WHERE " + state.wheres.map(w => w.sql).join(" AND ")
  //     : "";

  //   const values = state.wheres.flatMap(w => w.values);

  //   if (state.excludeFields.length) {
  //     const cols = await this.executeQuery(`SHOW COLUMNS FROM \`${this.tableName}\``);

  //     const allowed = cols
  //       .map(c => c.Field)
  //       .filter(c => !state.excludeFields.includes(c))
  //       .map(c => `\`${this.tableName}\`.\`${c}\``);

  //     selectSql = `SELECT ${allowed.join(", ")} FROM \`${this.tableName}\``;
  //   } else if (state.selectFields) {
  //     const fields = state.selectFields
  //       .map(f => `\`${this.tableName}\`.\`${f}\``)
  //       .join(", ");
  //     selectSql = `SELECT ${fields} FROM \`${this.tableName}\``;
  //   }

  //   const sql = `${selectSql}${joinSql}${whereSql} ${state.order} ${state.limit}`.trim();

  //   const rows = await this.executeQuery(sql, values);

  //   if (!Array.isArray(rows) || rows.length === 0) return null;
  //   if (rows.length === 1) return rows[0];
  //   return rows;
  // }

  // // ---------------- RAW QUERY ----------------------
  // async query(sql, params = []) {
  //   return this.executeQuery(sql, params);
  // }

  // // ---------------- PAGINATE ----------------------
  // async paginate({ page = 1, limit = 10, filters = {}, excludeFields = [] }) {
  //   const offset = (page - 1) * limit;

  //   const countWhere = Object.keys(filters).length
  //     ? "WHERE " + Object.keys(filters).map(k => `${k} = ?`).join(" AND ")
  //     : "";
  //   const countValues = Object.values(filters);

  //   const totalRows = await this.executeQuery(
  //     `SELECT COUNT(*) AS total FROM \`${this.tableName}\` ${countWhere}`,
  //     countValues
  //   );

  //   const data = await this
  //     .find(filters, excludeFields)
  //     .limit(limit)
  //     .orderBy("id", "DESC")
  //     .execute();

  //   return {
  //     data,
  //     pagination: {
  //       page,
  //       limit,
  //       totalRecords: totalRows[0].total,
  //       totalPages: Math.ceil(totalRows[0].total / limit),
  //     },
  //   };
  // }
}




// import pool from "../db/index.js";

  // export default class BaseModel {
  //   constructor(tableName) {
  //     this.tableName = tableName;
  //     this._reset();
  //   }

  //   _reset() {
  //     this._joins = [];
  //     this._wheres = [];
  //     this._excludeFields = [];
  //     this._order = "";
  //     this._limit = "";
  //     this._selectFields = null;
  //   }

  //   async executeQuery(sql, values = []) {
  //     return new Promise((resolve, reject) => {
  //       pool.query(sql, values, (err, results) => {
  //         if (err) return reject(err);
  //         resolve(results);
  //       });
  //     });
  //   }

  //   async create(data) {
  //     const sql = `INSERT INTO \`${this.tableName}\` SET ?`;
  //     const res = await this.executeQuery(sql, data);
  //     return res.insertId ?? res;
  //   }

  //   async createMany(dataArray = []) {
  //     if (!Array.isArray(dataArray) || dataArray.length === 0) {
  //       throw new Error('Data array must contain at least one record.');
  //     }
    
  //     const keys = Object.keys(dataArray[0]);
    
  //     const placeholders = dataArray
  //       .map(() => `(${keys.map(() => '?').join(',')})`)
  //       .join(',');
    
  //     const values = dataArray.flatMap(obj => keys.map(k => obj[k]));
    
  //     const query = `INSERT INTO ${this.tableName} (${keys.join(',')}) VALUES ${placeholders}`;
    
  //     const result = await this.executeQuery(query, values); // FIXED
    
  //     return {
  //       insertedCount: result.affectedRows,
  //       firstInsertId: result.insertId,
  //     };
  //   }
    
  //   async updateIgnore(data) {
  //     const fields = Object.keys(data);
  //     const placeholders = fields.map(() => "?").join(",");
  //     const values = Object.values(data);

  //     const sql = `
  //         UPDATE IGNORE INTO ${this.tableName} (${fields.join(",")})
  //         VALUES (${placeholders})
  //     `;

  //     return this.executeQuery(sql, values);
  //   }

  //   // async update(id, data) {
  //   //   const sql = `UPDATE \`${this.tableName}\` SET ? WHERE id = ?`;
  //   //   const res = await this.executeQuery(sql, [data, id]);
  //   //   return res.affectedRows ?? res;
  //   // }

  //   async update(filter = {}, update = {}) {
  //     if (!filter || typeof filter !== "object") {
  //       throw new Error("updateOne() expects a filter object.");
  //     }
    
  //     if (!update || typeof update !== "object") {
  //       throw new Error("updateOne() expects an update object.");
  //     }
    
  //     // WHERE clause
  //     const whereKeys = Object.keys(filter);
  //     if (whereKeys.length === 0) {
  //       throw new Error("updateOne() received an empty filter object.");
  //     }
    
  //     const whereSql = whereKeys.map(key => `\`${key}\` = ?`).join(" AND ");
  //     const whereValues = Object.values(filter);
    
  //     // SET clause
  //     const updateKeys = Object.keys(update);
  //     if (updateKeys.length === 0) {
  //       throw new Error("updateOne() update object has no fields.");
  //     }
    
  //     const setSql = updateKeys.map(key => `\`${key}\` = ?`).join(", ");
  //     const setValues = Object.values(update);
    
  //     // Final SQL
  //     const sql = `
  //       UPDATE \`${this.tableName}\`
  //       SET ${setSql}
  //       WHERE ${whereSql}
  //     `.trim();
    
  //     const result = await this.executeQuery(sql, [...setValues, ...whereValues]);
    
  //     return {
  //       matched: result.affectedRows || 0,
  //       modified: result.changedRows ?? result.affectedRows ?? 0
  //     };
  //   }
    
    

  //   // async delete(id) {
  //   //   const sql = `DELETE FROM \`${this.tableName}\` WHERE id = ?`;
  //   //   const res = await this.executeQuery(sql, [id]);
  //   //   return res.affectedRows ?? res;
  //   // }

  //   // async delete(whereObj) {
  //   //   if (!whereObj || typeof whereObj !== "object") {
  //   //     throw new Error("delete() expects a where object.");
  //   //   }
    
  //   //   const keys = Object.keys(whereObj); 
  //   //   if (keys.length === 0) {
  //   //     throw new Error("delete() received an empty where object.");
  //   //   }
    
  //   //   const conditions = keys.map(key => `\`${key}\` = ?`).join(" AND ");
  //   //   const values = Object.values(whereObj);
    
  //   //   const sql = `DELETE FROM \`${this.tableName}\` WHERE ${conditions}`;
    
  //   //   const res = await this.executeQuery(sql, values);
  //   //   return res?.affectedRows ?? res;
  //   // }
    
  //   async delete(filter = {}) {
  //     if (!filter || typeof filter !== "object") {
  //       throw new Error("deleteOne() expects a filter object.");
  //     }
    
  //     // Build WHERE clause
  //     const keys = Object.keys(filter);
  //     if (keys.length === 0) {
  //       throw new Error("deleteOne() received an empty filter object.");
  //     }
    
  //     const whereSql = keys.map(key => `\`${key}\` = ?`).join(" AND ");
  //     const values = Object.values(filter);
    
  //     // Final SQL
  //     const sql = `
  //       DELETE FROM \`${this.tableName}\`
  //       WHERE ${whereSql}
  //     `.trim();
    
  //     const result = await this.executeQuery(sql, values);
      
  //     return result?.affectedRows ?? result;

  //     // return {     
  //     //   // deleted: result.affectedRows || 0
  //     // };
  //   }

  //   async count(filter = {}) {
  //     let sql = `SELECT COUNT(*) AS total FROM \`${this.tableName}\``;
  //     let values = [];
    
  //     if (filter && Object.keys(filter).length > 0) {
  //       const keys = Object.keys(filter);
  //       const conditions = keys.map(k => `\`${k}\` = ?`).join(" AND ");
  //       values = Object.values(filter);
  //       sql += ` WHERE ${conditions}`;
  //     }
    
  //     const result = await this.executeQuery(sql, values);
    
  //     return result[0]?.total ?? 0;
  //   }
    



  //   find(filters = {}, excludeFields = []) {
  //     this._excludeFields = excludeFields;

  //     for (const [key, value] of Object.entries(filters)) {
  //       if (key.endsWith("_not")) {
  //         const col = key.replace("_not", "");
  //         this._wheres.push({ sql: `\`${col}\` != ?`, values: [value] });

  //       } else if (key.endsWith("_like")) {
  //         const col = key.replace("_like", "");
  //         this._wheres.push({ sql: `\`${col}\` LIKE ?`, values: [`%${value}%`] });

  //       } else if (Array.isArray(value)) {
  //         const ph = value.map(() => "?").join(", ");
  //         this._wheres.push({ sql: `\`${key}\` IN (${ph})`, values: value });

  //       } else {
  //         this._wheres.push({ sql: `\`${key}\` = ?`, values: [value] });
  //       }
  //     }

  //     return this;
  //   }

  //   selectFields(fields = []) {
  //     if (Array.isArray(fields)) {
  //       this._selectFields = fields;
  //     }
  //     return this;
  //   }
    

  //   join(table, condition, type = "left") {
  //     const joinType = type.toUpperCase() + " JOIN";
  //     this._joins.push(`${joinType} ${table} ON ${condition}`);
  //     return this;
  //   }

  //   orderBy(column, direction = "ASC") {
  //     this._order = `ORDER BY ${column} ${direction.toUpperCase()}`;
  //     return this;
  //   }

  //   limit(n) {
  //     this._limit = `LIMIT ${n}`;
  //     return this;
  //   }

    
  //   // ----------- Make the Query ----------
  //   async execute() {
  //     let selectSql = `SELECT * FROM \`${this.tableName}\``;

  //     const joinSql = this._joins.length ? " " + this._joins.join(" ") : "";

  //     const whereSql =
  //       this._wheres.length
  //         ? " WHERE " + this._wheres.map(w => w.sql).join(" AND ")
  //         : "";

  //     const values = this._wheres.flatMap(w => w.values);

  //     if (this._excludeFields.length) {
  //       const cols = await this.executeQuery(`SHOW COLUMNS FROM \`${this.tableName}\``);
  //       const allowed = cols
  //         .map(c => c.Field)
  //         .filter(c => !this._excludeFields.includes(c))
  //         .map(c => `\`${this.tableName}\`.\`${c}\``);

  //       selectSql = `SELECT ${allowed.join(", ")} FROM \`${this.tableName}\``;
  //     }

  //     const orderSql = this._order ? " " + this._order : "";
  //     const limitSql = this._limit ? " " + this._limit : "";

  //     const sql = `${selectSql}${joinSql}${whereSql}${orderSql}${limitSql}`;
  //     const rows = await this.executeQuery(sql, values);

  //     this._reset();
  //     // ---- Return Rules ----
  //     if (!Array.isArray(rows) || rows.length === 0) return null;  // NO DATA → null
  //     if (rows.length === 1) return rows[0];                      // ONE ROW → object
  //     return rows;   
  //     //return Array.isArray(rows) ? rows : [];

  //   }


  //   /**
  //    * Run a raw custom SQL query safely.
  //    * Usage:
  //    *   await Model.query("SELECT * FROM users WHERE status = ?", ["active"]);
  //    */
  //   async query(sql, params = []) {
  //     if (!sql || typeof sql !== "string") {
  //       throw new Error("query() expects a SQL string.");
  //     }

  //     if (!Array.isArray(params)) {
  //       throw new Error("query() expects params to be an array.");
  //     }

  //     return this.executeQuery(sql, params);
  //   }


  //   async paginate({ page = 1, limit = 10, filters = {}, excludeFields = [] }) {
  //     const offset = (page - 1) * limit;

  //     // total record count
  //     const countWhere = Object.keys(filters).length
  //       ? `WHERE ` + Object.keys(filters).map(k => `${k} = ?`).join(" AND ")
  //       : "";
  //     const countValues = Object.values(filters);
  //     const totalRows = await this.executeQuery(
  //       `SELECT COUNT(*) AS total FROM \`${this.tableName}\` ${countWhere}`,
  //       countValues
  //     );

  //     // fetch paginated rows
  //     const data = await this.find(filters, excludeFields)
  //       .limit(limit)
  //       .orderBy("id", "DESC")
  //       .execute();

  //     return {
  //       data,
  //       pagination: {
  //         page,
  //         limit,
  //         totalRecords: totalRows[0].total,
  //         totalPages: Math.ceil(totalRows[0].total / limit)
  //       }
  //     };
  //   }
  // }
