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
        createConnection: function () {},
        runQuery: function (query, cb) {
            cb();
        },
        endConnection: function (cb) {
            cb();
        },
        queries: {
            getCurrentVersion: 'SELECT version FROM schemaversion ORDER BY version DESC LIMIT 1',
            checkTable: "",
            makeTable: ""
        }
    };

    if (config.driver == 'mysql') {

        commonClient.dbDriver = require('mysql');

        commonClient.queries.checkTable = "SELECT * FROM information_schema.tables WHERE table_schema = '" + config.database + "' AND table_name = 'schemaversion';";
        commonClient.queries.makeTable = "CREATE TABLE schemaversion (version INT, PRIMARY KEY (version)); INSERT INTO schemaversion (version) VALUES (0);";

        commonClient.createConnection = function (cb) {
            var connection = commonClient.dbDriver.createConnection({
                multipleStatements: true,
                host: config.host,
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

        commonClient.dbDriver = require('pg.js');

        var connectionString = config.connectionString || "tcp://" + config.username + ":" + config.password + "@" + config.host + "/" + config.database;

        commonClient.queries.checkTable = "SELECT * FROM pg_catalog.pg_tables WHERE schemaname = CURRENT_SCHEMA AND tablename = 'schemaversion';";
        commonClient.queries.makeTable = "CREATE TABLE schemaversion (version INT PRIMARY KEY, name TEXT DEFAULT '', md5 TEXT DEFAULT ''); INSERT INTO schemaversion (version, name, md5) VALUES (0, '', '');";

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
            database: config.database,
            options: config.options,
            requestTimeout: oneHour
        };

        commonClient.queries.getCurrentVersion = 'SELECT TOP 1 version FROM schemaversion ORDER BY version DESC';
        commonClient.queries.checkTable = "SELECT * FROM information_schema.tables WHERE table_schema = 'dbo' AND table_name = 'schemaversion'";
        commonClient.queries.makeTable = "CREATE TABLE schemaversion (version INT PRIMARY KEY); INSERT INTO schemaversion (version) VALUES (0);";

        commonClient.createConnection = function (cb) {
            commonClient.dbDriver.connect(sqlconfig, function (err) {
                cb(err);
            });
        };

        commonClient.runQuery = function (query, cb) {
            var request = new commonClient.dbDriver.Request();
            request.batch(query, function (err, result) {
                cb(err, {rows: result});
            });
        };

        commonClient.endConnection = function (cb) {
            // mssql doesn't offer a way to kill a single connection
            // It'll die on its own, and won't prevent us from creating additional connections.
            // eventually this should maybe use the pooling mechanism, even though we only need one connection
            cb();
        };

    } else {
        throw new Error("db driver is not supported. Must either be " + supportedDrivers.join(" or ") + ".");
    }

    return commonClient;

};
