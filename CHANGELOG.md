# CHANGELOG

## 3.0.0
### In development

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