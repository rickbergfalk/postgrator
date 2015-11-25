// aka "universal" client
// here we'll wrap each of the database drivers in a unified interface

var supportedDrivers = ['pg', 'pg.js', 'mysql', 'mssql', 'tedious'];

module.exports = function (config) {

    if (supportedDrivers.indexOf(config.driver) === -1) {
        throw new Error("db driver is not supported. Must either be " + supportedDrivers.join(" or ") + ".");
    }

    var knex = require('knex');

    var commonClient = {
        connected: false,
        dbDriver: null,
        dbConnection: null,
        knex: null,
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
        commonClient.queries.makeTable = "CREATE TABLE " + config.schemaTable + " (version INT, PRIMARY KEY (version)); INSERT INTO " + config.schemaTable + " (version) VALUES (0);";

        commonClient.createConnection = function (cb) {
            var connection = {
                multipleStatements: true,
                host: config.host,
                user: config.username,
                password: config.password,
                database: config.database
            };

            commonClient.knex = knex({
              client: 'mysql',
              connection: connection
            });

            commonClient.dbConnection = commonClient.dbDriver.createConnection(connection);
            commonClient.dbConnection.connect(cb);
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
            commonClient.knex.destroy().then(function() {
              commonClient.dbConnection.end(cb);
            });
        };


    } else if (config.driver === 'pg' || config.driver === 'pg.js') {

        commonClient.dbDriver = require('pg.js');

        var connectionString = config.connectionString || "tcp://" + config.username + ":" + config.password + "@" + config.host + "/" + config.database;

        commonClient.queries.checkTable = "SELECT * FROM pg_catalog.pg_tables WHERE schemaname = CURRENT_SCHEMA AND tablename = '" + config.schemaTable + "';";
        commonClient.queries.makeTable = "CREATE TABLE " + config.schemaTable + " (version INT PRIMARY KEY, name TEXT DEFAULT '', md5 TEXT DEFAULT ''); INSERT INTO " + config.schemaTable + " (version, name, md5) VALUES (0, '', '');";

        commonClient.createConnection = function (cb) {
            commonClient.dbConnection = new commonClient.dbDriver.Client(connectionString);

            commonClient.knex = knex({
              client: 'pg',
              connection: connectionString
            });

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
            commonClient.knex.destroy().then(function() {
              commonClient.dbConnection.end();
              process.nextTick(cb);
            });
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
            request.batch(query, function (err, result) {
                cb(err, {rows: result});
            });
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
