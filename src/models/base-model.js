import pool from "../db/index.js";

export default class BaseModel {
  constructor(tableName, state = null) {
    this.tableName = tableName;
    this.state = state || {
      joins: [],
      wheres: [],
      excludeFields: [],
      order: "",
      limit: "",
      selectFields: null,
    };
  }

  clone(patch = {}) {
    const cloned = Object.create(Object.getPrototypeOf(this));
    cloned.tableName = this.tableName;
    cloned.state = {
      ...this.state,
      ...patch,
    };

    return cloned;
  }

  executeQuery(sql, values = []) {
    return new Promise((resolve, reject) => {
      pool.query(sql, values, (err, results) => {
        if (err) return reject(err);
        resolve(results);
      });
    });
  }

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
      .map(() => `(${keys.map(() => "?").join(",")})`)
      .join(",");

    const values = dataArray.flatMap((obj) => keys.map((key) => obj[key]));
    const sql = `INSERT INTO \`${this.tableName}\` (${keys.join(",")}) VALUES ${placeholders}`;
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

    const whereSql = whereKeys.map((key) => `\`${key}\` = ?`).join(" AND ");
    const setSql = updateKeys.map((key) => `\`${key}\` = ?`).join(", ");

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
      modified: result.changedRows ?? result.affectedRows ?? 0,
    };
  }

  async delete(filter = {}) {
    const keys = Object.keys(filter);
    if (keys.length === 0) throw new Error("Empty filter object.");

    const whereSql = keys.map((key) => `\`${key}\` = ?`).join(" AND ");
    const sql = `DELETE FROM \`${this.tableName}\` WHERE ${whereSql}`;
    const result = await this.executeQuery(sql, Object.values(filter));

    return result?.affectedRows ?? result;
  }

  async count(filter = {}) {
    let sql = `SELECT COUNT(*) AS total FROM \`${this.tableName}\``;
    let values = [];

    if (Object.keys(filter).length) {
      const whereSql = Object.keys(filter)
        .map((key) => `\`${key}\` = ?`)
        .join(" AND ");

      values = Object.values(filter);
      sql += ` WHERE ${whereSql}`;
    }

    const res = await this.executeQuery(sql, values);
    return res[0]?.total ?? 0;
  }

  normalizeFilterValue(value) {
    if (Array.isArray(value)) {
      return value.flatMap((item) => this.normalizeFilterValue(item));
    }

    if (value && typeof value === "object") {
      const values = Object.values(value);
      return values.length === 1 ? values[0] : value;
    }

    return value;
  }

  find(filters = {}, excludeFields = []) {
    const wheres = [];

    for (const [key, rawValue] of Object.entries(filters)) {
      if (rawValue === undefined || rawValue === null) continue;

      let field = key;
      let operator = "=";

      const opSuffixes = [
        "_like",
        "_not",
        "_in",
        "_between",
        "_is_null",
        "_not_null",
      ];

      for (const suffix of opSuffixes) {
        if (key.endsWith(suffix)) {
          field = key.replace(suffix, "");
          operator = suffix;
          break;
        }
      }

      const safeField = `\`${field}\``;
      const value = this.normalizeFilterValue(rawValue);

      switch (operator) {
        case "_like":
          wheres.push({ sql: `${safeField} LIKE ?`, values: [`%${value}%`] });
          break;

        case "_not":
          wheres.push({ sql: `${safeField} != ?`, values: [value] });
          break;

        case "_in": {
          const list = Array.isArray(value) ? value : [value];
          const normalizedList = list
            .flatMap((item) => this.normalizeFilterValue(item))
            .filter((item) => item !== undefined && item !== null && item !== "");

          if (normalizedList.length === 0) break;

          wheres.push({
            sql: `${safeField} IN (${normalizedList.map(() => "?").join(", ")})`,
            values: normalizedList,
          });
          break;
        }

        case "_between":
          if (!Array.isArray(rawValue) || rawValue.length !== 2) {
            throw new Error(`Invalid between filter for ${field}`);
          }

          wheres.push({
            sql: `${safeField} BETWEEN ? AND ?`,
            values: rawValue,
          });
          break;

        case "_is_null":
          wheres.push({ sql: `${safeField} IS NULL`, values: [] });
          break;

        case "_not_null":
          wheres.push({ sql: `${safeField} IS NOT NULL`, values: [] });
          break;

        default:
          if (Array.isArray(rawValue)) {
            const normalizedList = rawValue
              .flatMap((item) => this.normalizeFilterValue(item))
              .filter((item) => item !== undefined && item !== null && item !== "");

            if (normalizedList.length === 0) break;

            wheres.push({
              sql: `${safeField} IN (${normalizedList.map(() => "?").join(", ")})`,
              values: normalizedList,
            });
            break;
          }

          if (typeof rawValue === "string" && rawValue.trim().startsWith("!=")) {
            wheres.push({
              sql: `${safeField} != ?`,
              values: [rawValue.replace(/^!=\s*/, "")],
            });
            break;
          }

          wheres.push({ sql: `${safeField} = ?`, values: [value] });
          break;
      }
    }

    return this.clone({
      excludeFields: Array.isArray(excludeFields) ? excludeFields : [excludeFields],
      wheres,
    });
  }

  selectFields(fields = []) {
    const nextFields = Array.isArray(fields) ? fields : [fields];
    return this.clone({ selectFields: nextFields });
  }

  parseJoinInput(table, condition, typeOrOptions = "left") {
    const options =
      typeof typeOrOptions === "object" && typeOrOptions !== null
        ? typeOrOptions
        : { type: typeOrOptions };

    const type = (options.type || "left").toUpperCase();
    const tableExpression = table.trim();
    const tableParts = tableExpression.split(/\s+/);
    const hasInlineAlias = tableParts.length > 1;
    const baseTableName = tableParts[0];
    const alias = options.alias || (hasInlineAlias ? tableParts[tableParts.length - 1] : baseTableName);
    const joinTableSql =
      options.alias && !hasInlineAlias ? `${tableExpression} ${alias}` : tableExpression;

    return {
      table: baseTableName,
      alias,
      condition,
      type,
      select: Array.isArray(options.select)
        ? options.select
        : options.select
          ? [options.select]
          : [],
      joinSql: `${type} JOIN ${joinTableSql} ON ${condition}`,
    };
  }

  join(table, condition, typeOrOptions = "left") {
    const joinState = this.parseJoinInput(table, condition, typeOrOptions);
    return this.clone({ joins: [...this.state.joins, joinState] });
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

  async getSelectableColumns(tableName, alias, fields = null) {
    const columnRows = await this.executeQuery(`SHOW COLUMNS FROM \`${tableName}\``);
    const availableColumns = columnRows.map((column) => column.Field);
    const selectedColumns = Array.isArray(fields) && fields.length > 0 ? fields : availableColumns;

    return selectedColumns
      .filter((field) => availableColumns.includes(field))
      .map((field) => `\`${alias}\`.\`${field}\` AS \`${alias}_${field}\``);
  }

  async buildMainSelectColumns() {
    if (Array.isArray(this.state.selectFields) && this.state.selectFields.length > 0) {
      return this.state.selectFields.map((field) => `\`${this.tableName}\`.\`${field}\``);
    }

    if (Array.isArray(this.state.excludeFields) && this.state.excludeFields.length > 0) {
      const columns = await this.executeQuery(`SHOW COLUMNS FROM \`${this.tableName}\``);

      return columns
        .map((column) => column.Field)
        .filter((field) => !this.state.excludeFields.includes(field))
        .map((field) => `\`${this.tableName}\`.\`${field}\``);
    }

    return [`\`${this.tableName}\`.*`];
  }

  async buildJoinSelectColumns() {
    const joinSelects = [];

    for (const join of this.state.joins) {
      const alias = join.alias || join.table;
      const columns = await this.getSelectableColumns(join.table, alias, join.select);
      joinSelects.push(...columns);
    }

    return joinSelects;
  }

  async execute() {
    const mainSelect = await this.buildMainSelectColumns();
    const joinSelects = await this.buildJoinSelectColumns();
    const selectedColumns = [...mainSelect, ...joinSelects];

    const selectSql = `SELECT ${selectedColumns.join(", ")} FROM \`${this.tableName}\``;
    const joinSql = this.state.joins.length
      ? ` ${this.state.joins.map((join) => join.joinSql).join(" ")}`
      : "";
    const whereSql = this.state.wheres.length
      ? ` WHERE ${this.state.wheres.map((where) => where.sql).join(" AND ")}`
      : "";
    const values = this.state.wheres.flatMap((where) => where.values);
    const orderSql = this.state.order ? ` ${this.state.order}` : "";
    const limitSql = this.state.limit ? ` ${this.state.limit}` : "";

    const sql = `${selectSql}${joinSql}${whereSql}${orderSql}${limitSql}`;
    const rows = await this.executeQuery(sql, values);

    if (!Array.isArray(rows) || rows.length === 0) return null;
    if (rows.length === 1) return rows[0];
    return rows;
  }
}
