import type { ResolvedOptions } from "../types.js";
import Client from "./Client.js";
import MssqlClient from "./MssqlClient.js";
import MysqlClient from "./MysqlClient.js";
import PostgresClient from "./PostgresClient.js";
import Sqlite3Client from "./Sqlite3Client.js";

export default function createClient(config: ResolvedOptions): Client {
  switch (config.driver) {
    case "mysql":
      return new MysqlClient(config);
    case "pg":
      return new PostgresClient(config);
    case "mssql":
      return new MssqlClient(config);
    case "sqlite3":
      return new Sqlite3Client(config);
    default:
      throw new Error(
        `db driver not supported. Must one of: mysql, mssql, sqlite3 or pg`
      );
  }
}
