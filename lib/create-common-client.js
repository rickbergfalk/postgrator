// aka "universal" client
// here we'll wrap each of the database drivers in a unified interface

var supportedDrivers = ['pg', 'pg.js', 'mysql', 'mssql', 'tedious'];

module.exports = function (config) {

    if (supportedDrivers.indexOf(config.driver) === -1) {
        throw new Error("db driver is not supported. Must either be " + supportedDrivers.join(" or ") + ".");
    }

    var commonClient = {
        connected: false,
        dbDriver: null,
        dbConnection: null,
        schemaTable: config.schemaTable,
        createConnection: function () {},
        runQuery: function (query, cb) {
            cb();
        },
        endConnection: function (cb) {
            cb();
        },
        queries: {
            getCurrentVersion: 'SELECT version FROM ' + config.schemaTable + ' ORDER BY version DESC LIMIT 1',
            checkTable: "",
            makeTable: ""
        }
    };

    if (config.driver == 'mysql') {

        commonClient.dbDriver = require('mysql');

        commonClient.queries.checkTable = "SELECT * FROM information_schema.tables WHERE table_schema = '" + config.database + "' AND table_name = '" + config.schemaTable + "';";
        commonClient.queries.makeTable = "CREATE TABLE " + config.schemaTable + " (version BIGINT, PRIMARY KEY (version)); INSERT INTO " + config.schemaTable + " (version) VALUES (0);";

        commonClient.createConnection = function (cb) {
            var connection = commonClient.dbDriver.createConnection({
                multipleStatements: true,
                host: config.host,
                port: config.port,
                user: config.username,
                password: config.password,
                database: config.database
            });
            commonClient.dbConnection = connection;
            connection.connect(cb);
        };

        commonClient.runQuery = function (query, cb) {
            commonClient.dbConnection.query(query, function (err, rows, fields) {
                if (err) {
                    cb(err);
                } else {
                    var results = {};
                    if (rows) results.rows = rows;
                    if (fields) results.fields = fields;
                    cb(err, results);
                }
            });
        };

        commonClient.endConnection = function (cb) {
            commonClient.dbConnection.end(cb);
        };


    } else if (config.driver === 'pg' || config.driver === 'pg.js') {

        commonClient.dbDriver = require('pg');

        // for backward compatibility, allows to specify port within host
        if (config.port) {
            // but if port specified, be sure it overrides value that may be in host
            var idx = config.host.indexOf(':')
            config.host = config.host.substr(0, idx === -1 ? undefined : idx) + ':' + config.port
        }

        var connectionString = config.connectionString || "tcp://" + config.username + ":" + config.password + "@" + config.host + "/" + config.database;

        commonClient.queries.checkTable = "SELECT * FROM pg_catalog.pg_tables WHERE schemaname = CURRENT_SCHEMA AND tablename = '" + config.schemaTable + "';";
        commonClient.queries.makeTable = "CREATE TABLE " + config.schemaTable + " (version BIGINT PRIMARY KEY, name TEXT DEFAULT '', md5 TEXT DEFAULT ''); INSERT INTO " + config.schemaTable + " (version, name, md5) VALUES (0, '', '');";

        commonClient.createConnection = function (cb) {
            commonClient.dbConnection = new commonClient.dbDriver.Client(connectionString);
            commonClient.dbConnection.connect(function (err) {
                cb(err);
            });
        };

        commonClient.runQuery = function (query, cb) {
            commonClient.dbConnection.query(query, function (err, result) {
                cb(err, result);
            });
        };

        commonClient.endConnection = function (cb) {
            commonClient.dbConnection.end();
            process.nextTick(cb);
        };

    } else if (config.driver == 'mssql' || config.driver == 'tedious') {

        commonClient.dbDriver = require('mssql');

        var oneHour = 1000 * 60 * 60;

        var sqlconfig = {
            user: config.username,
            password: config.password,
            server: config.host,
            port: config.port,
            database: config.database,
            options: config.options,
            requestTimeout: config.requestTimeout || oneHour
        };

        commonClient.queries.getCurrentVersion = 'SELECT TOP 1 version FROM ' + config.schemaTable + ' ORDER BY version DESC';
        commonClient.queries.checkTable = "SELECT * FROM information_schema.tables WHERE table_schema = 'dbo' AND table_name = '" + config.schemaTable + "'";
        commonClient.queries.makeTable = "CREATE TABLE " + config.schemaTable + " (version BIGINT PRIMARY KEY); INSERT INTO " + config.schemaTable + " (version) VALUES (0);";

        commonClient.createConnection = function (cb) {
            commonClient.dbConnection = commonClient.dbDriver.connect(sqlconfig, function (err) {
                cb(err);
            });
        };

        commonClient.runQuery = function (query, cb) {
            var request = new commonClient.dbDriver.Request();
            var batches = query.split(/^\s*GO\s*$/im);

            var runBatch = function(batchIndex) {
                request.batch(batches[batchIndex], function (err, result) {
                    if (err || batchIndex === batches.length - 1) {
                        cb(err, {rows: result});
                    } else {
                        runBatch(batchIndex + 1);
                    }
                });
            };

            runBatch(0);
        };

        commonClient.endConnection = function (cb) {
            commonClient.dbConnection.close();
            cb();
        };

    } else {
        throw new Error("db driver is not supported. Must either be " + supportedDrivers.join(" or ") + ".");
    }

    return commonClient;

};
