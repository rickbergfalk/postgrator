import MssqlClient from "./MssqlClient.js";
import MysqlClient from "./MysqlClient.js";
import PostgresClient from "./PostgresClient.js";
import Sqlite3Client from "./Sqlite3Client.js";

export default function createClient(config) {
  if (config.driver === "mysql") {
    return new MysqlClient(config);
  } else if (config.driver === "pg") {
    return new PostgresClient(config);
  } else if (config.driver === "mssql") {
    return new MssqlClient(config);
  } else if (config.driver === "sqlite3") {
    return new Sqlite3Client(config);
  } else {
    throw new Error(
      `db driver '${config.driver}' not supported. Must one of: mysql, mssql, sqlite3 or pg`
    );
  }
}
