'use strict';

const mysql = require('mysql');
const winston = require('winston');
const nconf = require('nconf');
const MySQLStore = require('express-mysql-session')(require('express-session'));

const mysqlModule = module.exports;

const connection = require('./mysql/connection');

mysqlModule.questions = [
    {
        name: 'mysql:host',
        description: 'Host IP or address of your MySQL instance',
        default: nconf.get('mysql:host') || nconf.get('defaults:mysql:host') || '127.0.0.1',
    },
    {
        name: 'mysql:port',
        description: 'Host port of your MySQL instance',
        default: nconf.get('mysql:port') || nconf.get('defaults:mysql:port') || 3306,
    },
    {
        name: 'mysql:user',
        description: 'MySQL username',
        default: nconf.get('mysql:user') || nconf.get('defaults:mysql:user') || 'root',
    },
    {
        name: 'mysql:password',
        description: 'Password of your MySQL database',
        hidden: true,
        default: nconf.get('mysql:password') || nconf.get('defaults:mysql:password') || '',
    },
    {
        name: 'mysql:database',
        description: 'MySQL database name',
        default: nconf.get('mysql:database') || nconf.get('defaults:mysql:database') || 'nodebb',
    },
];

mysqlModule.init = async function (opts) {
    opts = opts || nconf.get('mysql');
    const pool = await connection.connect(opts);
    mysqlModule.pool = pool;
    mysqlModule.client = pool;
    const poolConnection = await pool.getConnection();
    try {
        await checkUpgrade(poolConnection);
        winston.info('[mysql] Initialization complete.');
    } catch (err) {
        winston.error(`[mysql] Initialization failed: ${JSON.stringify(err, Object.getOwnPropertyNames(err), 2)}`);
        throw err;
    } finally {
        poolConnection.release();
    }
};

/**
 * 
 * @param {import('mysql2/promise').PoolConnection} poolConnection 
 */
async function checkUpgrade(poolConnection) {
    let queryResult = await poolConnection.query(`
        CREATE TABLE IF NOT EXISTS legacy_object (
            _key VARCHAR(255) NOT NULL,
            type ENUM('hash', 'zset', 'set', 'list', 'string') NOT NULL,
            expireAt DATETIME DEFAULT NULL,
            PRIMARY KEY (_key),
            UNIQUE KEY (_key, type)
        )
    `);
    winston.info(JSON.stringify(queryResult, null, 2));

    queryResult = await poolConnection.query(`
        CREATE TABLE IF NOT EXISTS legacy_object (
            _key VARCHAR(255) NOT NULL,
            type ENUM('hash', 'zset', 'set', 'list', 'string') NOT NULL,
            expireAt DATETIME DEFAULT NULL,
            PRIMARY KEY (_key),
            UNIQUE KEY unique_key_type (_key, type)
        )
    `);
    winston.info(JSON.stringify(queryResult, null, 2));

    queryResult = await poolConnection.query(`
        CREATE TABLE IF NOT EXISTS legacy_hash (
            _key VARCHAR(255) NOT NULL,
            data JSON NOT NULL,
            type ENUM('hash', 'zset', 'set', 'list', 'string') NOT NULL DEFAULT 'hash',
            type_check ENUM('hash') GENERATED ALWAYS AS (type) VIRTUAL,
            PRIMARY KEY (_key),
            CONSTRAINT fk_legacy_hash_key
                FOREIGN KEY (_key, type)
                REFERENCES legacy_object(_key, type)
                ON UPDATE CASCADE
                ON DELETE CASCADE,
            CONSTRAINT check_type_hash CHECK (type_check = 'hash')
        )
    `);
    winston.info(JSON.stringify(queryResult, null, 2));

    queryResult = await poolConnection.query(`
        CREATE TABLE IF NOT EXISTS legacy_zset (
            _key VARCHAR(255) NOT NULL,
            value TEXT NOT NULL,
            score DECIMAL NOT NULL,
            type ENUM('hash', 'zset', 'set', 'list', 'string') NOT NULL DEFAULT 'zset',
            type_check ENUM('zset') GENERATED ALWAYS AS (type) VIRTUAL,
            PRIMARY KEY (_key, value(191)),
            CONSTRAINT fk_legacy_zset_key
                FOREIGN KEY (_key, type)
                REFERENCES legacy_object(_key, type)
                ON UPDATE CASCADE
                ON DELETE CASCADE,
            CONSTRAINT check_type_zset CHECK (type_check = 'zset')
        )
    `);
    winston.info(JSON.stringify(queryResult, null, 2));

    queryResult = await poolConnection.query(`
        CREATE TABLE IF NOT EXISTS legacy_set (
            _key VARCHAR(255) NOT NULL,
            member TEXT NOT NULL,
            type ENUM('hash', 'zset', 'set', 'list', 'string') NOT NULL DEFAULT 'set',
            type_check ENUM('set') GENERATED ALWAYS AS (type) VIRTUAL,
            PRIMARY KEY (_key, member(191)),
            CONSTRAINT fk_legacy_set_key
                FOREIGN KEY (_key, type)
                REFERENCES legacy_object(_key, type)
                ON UPDATE CASCADE
                ON DELETE CASCADE,
            CONSTRAINT check_type_set CHECK (type_check = 'set')
        )
    `);
    winston.info(JSON.stringify(queryResult, null, 2));

    queryResult = await poolConnection.query(`
        CREATE TABLE IF NOT EXISTS legacy_list (
            _key VARCHAR(255) NOT NULL,
            array JSON NOT NULL,
            type ENUM('hash', 'zset', 'set', 'list', 'string') NOT NULL DEFAULT 'list',
            type_check ENUM('list') GENERATED ALWAYS AS (type) VIRTUAL,
            PRIMARY KEY (_key),
            CONSTRAINT fk_legacy_list_key
                FOREIGN KEY (_key, type)
                REFERENCES legacy_object(_key, type)
                ON UPDATE CASCADE
                ON DELETE CASCADE,
            CONSTRAINT check_type_list CHECK (type_check = 'list')
        )
    `);
    winston.info(JSON.stringify(queryResult, null, 2));

    queryResult = await poolConnection.query(`
        CREATE TABLE IF NOT EXISTS legacy_string (
            _key VARCHAR(255) NOT NULL,
            data TEXT NOT NULL,
            type ENUM('hash', 'zset', 'set', 'list', 'string') NOT NULL DEFAULT 'string',
            type_check ENUM('string') GENERATED ALWAYS AS (type) VIRTUAL,
            PRIMARY KEY (_key),
            CONSTRAINT fk_legacy_string_key
                FOREIGN KEY (_key, type)
                REFERENCES legacy_object(_key, type)
                ON UPDATE CASCADE
                ON DELETE CASCADE,
            CONSTRAINT check_type_string CHECK (type_check = 'string')
        )
    `);
    winston.info(JSON.stringify(queryResult, null, 2));

    queryResult = await poolConnection.query(`
        CREATE OR REPLACE VIEW legacy_object_live AS
        SELECT _key, type
          FROM legacy_object
         WHERE expireAt IS NULL
            OR expireAt > NOW()
    `);
    winston.info(JSON.stringify(queryResult, null, 2));
}

mysqlModule.query = function (sql, params, callback) {
    if (!connection) {
        return callback(new Error('No MySQL connection established.'));
    }

    connection.query(sql, params, (err, results) => {
        if (err) {
            winston.error('Error executing query:', err);
            return callback(err);
        }
        callback(null, results);
    });
};

mysqlModule.close = async function () {
    if (connection) {
        await connection.close(mysqlModule.pool);
    } else {
        winston.error('No MySQL connection to close.');
    }
};

mysqlModule.createSessionStore = function (sessionOptions) {
    const storeOptions = {
        host: nconf.get('mysql:host') || 'localhost',
        port: nconf.get('mysql:port') || 3306,
        user: nconf.get('mysql:user') || 'root',
        password: nconf.get('mysql:password') || '',
        database: nconf.get('mysql:database') || 'sessions',
    };

    return new MySQLStore(storeOptions, connection);
};

require('./mysql/hash')(mysqlModule);