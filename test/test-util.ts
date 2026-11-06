import pg from "pg";
import Postgrator from "../src/postgrator.js";
import mssql from "mssql";
import mysql from "mysql";
import sqlite3 from "sqlite3";
import Database from "better-sqlite3";
import {
  PostgreSQLOptions,
  MySQLOptions,
  MsSQLOptions,
  Sqlite3Options,
} from "../src/types.js";
import type { ExecQuery, Options, QueryResult } from "../src/types.js";

export interface PostgratorEnd {
  postgrator: Postgrator;
  end: () => Promise<void> | void;
}

export type DriverTestOptions =
  | (Omit<PostgreSQLOptions, "execQuery"> & {
      execQuery?: ExecQuery;
      betterSqlite3?: boolean;
    })
  | (Omit<MySQLOptions, "execQuery"> & {
      execQuery?: ExecQuery;
      betterSqlite3?: boolean;
    })
  | (Omit<MsSQLOptions, "execQuery"> & {
      execQuery?: ExecQuery;
      betterSqlite3?: boolean;
    })
  | (Omit<Sqlite3Options, "execQuery"> & {
      execQuery?: ExecQuery;
      betterSqlite3?: boolean;
    });

export async function getPostgratorEnd(
  config: DriverTestOptions
): Promise<PostgratorEnd> {
  if (config.driver === "pg") {
    const client = new pg.Client({
      host: "localhost",
      port: 5432,
      database: "postgrator",
      user: "postgrator",
      password: "postgrator",
    });

    await client.connect();

    const execQuery = (query: string) => client.query(query);
    const end = () => client.end();

    const postgrator = new Postgrator({
      ...config,
      execQuery,
    });

    return {
      postgrator,
      end,
    };
  }

  if (config.driver === "mssql") {
    const client = new mssql.ConnectionPool({
      server: "localhost",
      database: "master",
      user: "sa",
      password: "Postgrator123!",
      options: {
        encrypt: false, // for azure
        trustServerCertificate: true, // change to true for local dev / self-signed certs. defaults to false
      },
      requestTimeout: 15000,
      connectionTimeout: 15000,
      pool: {
        max: 1,
        min: 1,
      },
    });

    await client.connect();

    const postgrator = new Postgrator({
      ...config,
      execQuery: (query) => {
        return new Promise<QueryResult>((resolve, reject) => {
          const request = new mssql.Request(client);

          request.batch(query, (err, result) => {
            if (err) {
              return reject(err);
            }
            return resolve({
              rows: (result && result.recordset
                ? result.recordset
                : result) as any[],
            });
          });
        });
      },
    });

    return {
      postgrator,
      end: () => client.close(),
    };
  }

  if (config.driver === "mysql") {
    const connection = mysql.createConnection({
      multipleStatements: true,
      host: "localhost",
      database: "postgrator",
      user: "postgrator",
      password: "postgrator",
    });

    await new Promise<void>((resolve, reject) => {
      connection.connect((err) => {
        if (err) {
          return reject(err);
        }
        resolve();
      });
    });

    const postgrator = new Postgrator({
      ...config,
      execQuery: (query) => {
        return new Promise<QueryResult>((resolve, reject) => {
          connection.query(query, (err, rows, fields) => {
            if (err) {
              return reject(err);
            }
            const results = { rows, fields };
            resolve(results);
          });
        });
      },
    });

    return {
      postgrator,
      end: () =>
        new Promise<void>((resolve, reject) => {
          connection.end((err) => {
            if (err) {
              return reject(err);
            }
            resolve();
          });
        }),
    };
  }

  if (config.driver === "sqlite3" && config.betterSqlite3) {
    const db = new Database(":memory:");

    const execQuery = (query: string) => {
      return new Promise<QueryResult>((resolve) => {
        const stm = db.prepare(query);
        try {
          const rows = stm.all();
          resolve({ rows });
        } catch (err) {
          if (
            err instanceof Error &&
            err.message.indexOf("This statement does not return data") >= 0
          ) {
            stm.run();
            resolve({ rows: [] });
          }
          throw err;
        }
      });
    };

    const execSqlScript = (sqlScript: string) => {
      return new Promise<void>((resolve) => {
        db.exec(sqlScript);
        resolve();
      });
    };

    const postgrator = new Postgrator({
      ...config,
      execQuery,
      execSqlScript,
    });

    return {
      postgrator,
      end: () =>
        new Promise<void>((resolve, reject) => {
          try {
            db.close();
            resolve();
          } catch (err) {
            reject(err);
          }
        }),
    };
  }

  if (config.driver === "sqlite3") {
    const db = new sqlite3.Database(":memory:");

    const execQuery = (query: string) => {
      return new Promise<QueryResult>((resolve, reject) => {
        db.all(query, (err, rows) => {
          if (err) {
            return reject(err);
          }
          resolve({ rows });
        });
      });
    };

    const execSqlScript = (sqlScript: string) => {
      return new Promise<void>((resolve, reject) => {
        db.exec(sqlScript, (err) => {
          if (err) {
            return reject(err);
          }
          resolve();
        });
      });
    };

    const postgrator = new Postgrator({
      ...config,
      execQuery,
      execSqlScript,
    });

    return {
      postgrator,
      end: () =>
        new Promise<void>((resolve, reject) => {
          db.close((err) => {
            if (err) {
              reject(err);
              return;
            }
            resolve();
          });
        }),
    };
  }

  throw new Error("Unsupported driver configuration");
}

export default {
  getPostgratorEnd,
};
