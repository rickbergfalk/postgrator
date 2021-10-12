/**
 * Check if schema rows has row for column name
 * Checks field column_name and COLUMN_NAME due to db/driver quirks
 * @param {array<object>} schemaResultRows
 * @param {string} columnName
 */
function hasColumnName(schemaResultRows, columnName) {
  const row = schemaResultRows.find(
    (row) => row.column_name === columnName || row.COLUMN_NAME === columnName
  );
  return row !== undefined;
}

class Client {
  constructor(config) {
    this.config = config;
  }

  persistActionSql(migration) {
    const { config } = this;
    const action = migration.action.toLowerCase();
    if (action === "do") {
      return `
          INSERT INTO ${config.schemaTable} (version, name, md5, run_at) 
          VALUES (
            ${migration.version}, 
            '${migration.name}', 
            '${migration.md5}',
            '${new Date().toISOString().replace("T", " ").replace("Z", "")}'
          );`;
    }
    if (action === "undo") {
      return `
          DELETE FROM ${config.schemaTable} 
          WHERE version = ${migration.version};`;
    }
    throw new Error("unknown migration action");
  }

  getMd5Sql(migration) {
    const { config } = this;
    return `
      SELECT md5 
      FROM ${config.schemaTable} 
      WHERE version = ${migration.version};
    `;
  }

  getDatabaseVersionSql() {
    const { config } = this;
    return `
      SELECT version 
      FROM ${config.schemaTable} 
      ORDER BY version DESC 
      LIMIT 1
    `;
  }

  async runQuery(query) {
    const { config } = this;
    if (config.driver === "pg" && config.currentSchema) {
      await config.execQuery(`SET search_path = ${config.currentSchema}`);
    }
    return config.execQuery(query);
  }

  async ensureTable() {
    const { config } = this;
    const sql = this.getColumnsSql();
    const results = await this.runQuery(sql);

    const { rows } = results;
    const sqls = [];

    if (rows.length === 0) {
      if (config.driver === "pg") {
        // When using pg, create a schema if schemaTable has a `.` in it
        const schema = config.schemaTable.split(".");
        if (schema[1]) {
          sqls.push(`CREATE SCHEMA IF NOT EXISTS ${schema[0]};`);
        }
      }

      sqls.push(`
          CREATE TABLE ${config.schemaTable} (
            version BIGINT PRIMARY KEY
          ); 
          INSERT INTO ${config.schemaTable} (version) 
            VALUES (0);
        `);
    }
    if (!hasColumnName(rows, "name")) {
      sqls.push(this.getAddNameSql());
    }
    if (!hasColumnName(rows, "md5")) {
      sqls.push(this.getAddMd5Sql());
    }
    if (!hasColumnName(rows, "run_at")) {
      sqls.push(this.getAddRunAtSql());
    }

    for (const sql of sqls) {
      await this.runQuery(sql);
    }
  }
}

module.exports = Client;
