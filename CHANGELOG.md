# CHANGELOG

## 8.0.0

### November 11, 2024

- Update `glob` to latest dependency, which technically only supports `Node v20 or later`. Which technically, makes this a breaking change?

## 7.3.0

### September 3, 2024

- Support `sqlite3` and `better-sqlite3` migrations with `;` in statements.

- Add `execSqlScript` option to execute migrations consisting of multiple statements. If not supplied, Postgrator will fallback to using `execQuery`.

## 7.2.0

### July 9, 2023

- Support `better-sqlite3`

## 7.1.1

### September 21, 2022

- Fix migration method code comment
- Use INTEGER for sqlite3 version type

## 7.1.0

### March 31, 2022

- Add `sqlite3` support

## 7.0.0

### February 23, 2022

- `getDatabaseVersion` returns 0 when schema version table does not exist instead of `undefined`. This is technically **breaking** if you rely on the `undefined` returned in version 5.0.1.
- Fix DEP0151 warning about ext resolution

## 6.0.0

### February 21, 2022

### Breaking

Postgrator is now an ES module and requires Node 14 or later. `.cjs` and `.mjs` migration files are now supported.

No other changes have been made.

## 5.0.1

### February 18, 2022

- Fix `getDatabaseVersion` error when schemaversion table does not exist. `undefined` is returned instead.

## 5.0.0

### October 14, 2021

Version 5 represents an effort to simplify things, allow more flexibility, and reduce the maintenance of this package.

This is made possible by requiring the database query execution function be injected to postgrator. Postgrator no longer manages the database connection, and as a result no longer needs to maintain a mapping to specific database driver implementations.

Despite all the breaking changes below, nothing has changed in the overall migration file approach. Migrations that worked for previous versions of postgrator will still work in v5.

**See `examples/` directory for quick overview of how v5 is used.**

### Features

- md5 validation may be skipped for specific migrations by deleting the md5 value from your DB's schemaversion table.

### Fixes

- Honors uppercase characters in postgres schema table name (#98)
- JS migrations no longer run during validation, preventing unwanted migration failures (#124)

### BREAKING

- Nodejs 12 or later required.
- Removed `host`, `port`, `username`, `password`, `ssl`, `options`. Manage connections with `execQuery` instead.
- Driver value `mysql2` unsupported. (You can still use the `mysql2` package for your `execQuery` implementation, but set driver to `mysql`)
- Removed`migrationDirectory` option. Use `migrationPattern` instead. In most cases it will be `path/to/migrations/*`. Any [glob](https://www.npmjs.com/package/glob) syntax supported.
- Removed `GO` keyword splitting for `mssql`. Using `GO` could leave your system in a partially migrated state on failure and is not recommended.
- filename in migration result is full file path
- Removed md5 checksum validation for JS migrations. JS migrations are dynamic, and JS style trends could vary over time if a tool like Prettier is applied.
- JS migrations do not generate SQL until immediately prior to being applied. Previously, JS migrations generated SQL prior to any migrations running. This was problematic for cases where JS migrations no longer successfullly generated SQL.

## 4.3.1

### October 9, 2021

- Undeprecate `currentSchema` config. It'll stay for v5.

## 4.3.0

### October 8, 2021

- Add `execQuery` function option to allow maximum flexibility in database connection management. Postgrator-owned database connections (the connections established using host, username, password, etc.) are deprecated, and will be removed in Postgrator 5.
- Deprecate `host`, `port`, `username`, `password`, `ssl`, `options`, `currentSchema` config.
- Deprecate `runQuery` utility function (use your db driver directly).
- Deprecate `migrationDirectory` in favor of `migrationPattern` glob.

## 4.2.0

### July 25, 2021

- Add support for `mssql` 7

## 4.1.1

### October 29, 2020

- Fix pg SSL config when using connectionString

## 4.1.0

### October 9, 2020

- Add async function migration support
- Update dependencies

## 4.0.1

### June 15, 2020

- Fix Postgres SSL typings

## 4.0.0

### April 10, 2020

- BREAKING: Node.js 10 or later required
- Add support for `pg` 8.x.x

## 3.11.1

### April 10, 2020

- Fix to avoid running migrations with same number
- Update dependencies
- Fix Windows compat

## 3.11.0

### December 2, 2019

- Add support for driver mysql2@2
- Add support for driver mssql@6
- Fix non-default schema use for mssql (#94)

## 3.10.2

### June 4, 2019

- Fix MySQL option typings for mysql2

## 3.10.1

### March 21, 2019

- Fix TypeScript type for currentSchema postgres option

## 3.10.0

### March 20, 2019

- Add support for mssql 5.x

## 3.9.0

### March 14, 2019

- Add mssql domain option
- Filter out non-migration files to avoid filename parsing errors

## 3.8.0

### Feb 17 2019

- Add currentSchema option for Postgres

## 3.7.0

### October 14 2018

- Add support for mysql2
- Add support for ssl config for mysql
- Fix: close db connection on migration error
- Fix: support schema detection for MySQL 8.0
- Fix: Don't wait for postgres connection end response

## 3.6.0

### April 26 2018

- Allow schema to be specified for schemaTable (Postgres only) If schema does
  not exist it will be created.

## 3.5.0

### Feb 17 2018

- Add connectionTimeout config for mssql

## 3.4.0

### Jan 21 2018

- Adds support for managing multiple databases/schemas on single
  cluster/database

## 3.3.0

### Jan 16 2018

- Adds incompatible version warnings for installed db drivers

## 3.2.0

### Jan 15 2018

- Add support for pg@6

## 3.1.0

### Dec 24 2017

- Fix: allow filenames longer than 32 char for mssql
- Add option to specify glob pattern for migration files

## 3.0.0

### Nov 18 2017

#### Features / Improvements

- `run_at` timestamp column added to schema table
- `md5` and `name` columns added for all implementations
- Checksum validation now implemented for all drivers
- Checksum validation may be skipped using config `validateChecksums: false`
- Callback API replaced with Promises
- Connections opened/closed automatically (no more `.endConnection()`)
- Lots of tests

#### Breaking changes

- Node 6 or greater now required
- DB drivers must be installed prior to use (`pg`, `mysql`, `mssql`)
- `pg.js` and `tedious` no longer valid driver config option
- None of the API is the same
- Checksums now validated by default for all drivers
- Calling `.migrate()` without input migrates to latest/max
- Logging to console removed

## 2.10.0

### May 6 2017

- Allow migration SQL to be generated via js function

## 2.9.0

### Apr 6 2017

- Added postgres ssl support

## 2.8.0

### Apr 26 2016

- Allow port configuration

## 2.6.0

### Jan 20 2016

- Added config to toggle logging progress
- Added config for requestTimeout
- Added support for mssql batches using GO keyword

## 2.5.0

### Aug 25 2015

- Exposed functions to get current/max migration versions

## 2.4.0

### Aug 19 2015

- Added config for schematable name
- Added config for checksum newline ending normalization

## 2.3.0

### June 15 2015

- Version column increased to BIGINT

## 2.2.0

### Apr 30 2015

- SQL Server connections closed with endConnection()
- Update db driver modules

## 2.1.0

### Feb 7 2015

- Update mssql config: timeout set to 1 hour
- Add version as PK on schemaversion table

## 2.0.0

### Nov 20 2014

- Checksum validation added for postgres
- postgrator.migrate('max', cb) added to migrate to latest version

## 1.x

### Nov 6 2014

Initial version released

## 0.x

### Dec 12 2012

Initial development
