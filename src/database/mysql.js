'use strict';

/**
 * @typedef {import ('../../types/database').Database} Database
 * @typedef {import ('../../types/database').MySQLDatabase} MySQLDatabase
 */

const winston = require('winston');
const nconf = require('nconf');
const semver = require('semver');

/**
 * @type {MySQLDatabase}
 */
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
        name: 'mysql:username',
        description: 'MySQL username',
        default: nconf.get('mysql:username') || nconf.get('defaults:mysql:username') || 'root',
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

mysqlModule.initialized = false;
mysqlModule.init = async function (opts) {
    if (mysqlModule.initialized) {
        winston.info('[mysql] Already initialized.');
        return;
    }
    mysqlModule.initialized = true;

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
            score BIGINT NOT NULL,
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
        winston.verbose('MySQL connection closed.');
    } else {
        winston.error('No MySQL connection to close.');
    }
    await Promise.all(sessionStores.map((store) => store.close()));
    sessionStores.length = 0;
    winston.verbose('MySQL session stores closed.');

    mysqlModule.pool = null;
    mysqlModule.client = null;

    await Promise.all(sessionStoresPools.map((pool) => {
        return connection.close(pool);
    }));
    sessionStoresPools.length = 0;
};

const session = require('express-session');
const MySQLStore = require('express-mysql-session')(session);

/**
 * @type {import('express-mysql-session').MySQLStore[]}
 */
const sessionStores = [];

/**
 * @type {import('mysql2/promise').Pool[]}
 */
const sessionStoresPools = [];

mysqlModule.createSessionStore = async function (options) {
    const meta = require('../meta');

    /**
     * @param {import('mysql2/promise').Pool} pool 
     * @returns 
     */
    async function createStore(pool) {
        const store = new MySQLStore({
            expiration: meta.getSessionTTLSeconds() * 1000,
            createDatabaseTable: false,
            schema: {
                tableName: 'session',
                columnNames: {
                    session_id: 'sid',
                    expires: 'expire',
                    data: 'sess'
                }
            },
            clearExpired: nconf.get('isPrimary'),
            checkExpirationInterval: nconf.get('isPrimary') ? 60000 : 0
        }, pool);
        sessionStores.push(store);
        return store;
    }

    const pool = await connection.connect(options);
    sessionStoresPools.push(pool);

    if (nconf.get('isPrimary')) {
        await pool.execute(`
            CREATE TABLE IF NOT EXISTS session (
                sid VARCHAR(32) NOT NULL PRIMARY KEY,
                sess JSON NOT NULL,
                expire BIGINT NOT NULL,
                INDEX session_expire_idx (expire)
            ) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
        `);
    }

    return await createStore(pool);
};

mysqlModule.createIndices = async function () {
    if (!mysqlModule.pool) {
        winston.warn('[database/createIndices] database not initialized');
        return;
    }
    winston.info('[database] Checking database indices.');
    try {
        try {
            await mysqlModule.pool.query(`
                CREATE INDEX idx__legacy_zset__key__score 
                ON legacy_zset(_key ASC, score DESC)
            `);
        } catch (err) {
            if (err.errno !== 1061) { // ER_DUP_KEYNAME
                throw err; // Rethrow if it's not a duplicate key error
            }
            // Silently ignore if the index already exists
        }
        try {
            await mysqlModule.pool.query(`
                CREATE INDEX idx__legacy_object__expireAt 
                ON legacy_object(expireAt ASC)
            `);
        } catch (err) {
            if (err.errno !== 1061) { // ER_DUP_KEYNAME
                throw err; // Rethrow if it's not a duplicate key error
            }
            // Silently ignore if the index already exists
        }
        winston.info('[database] Checking database indices done!');
    } catch (err) {
        winston.error(`Error creating index ${err.message}`);
        throw err;
    }
};

mysqlModule.checkCompatibility = async function (callback) {
    const mysqlPkg = require('mysql2/package.json');
    await mysqlModule.checkCompatibilityVersion(mysqlPkg.version, callback);
};

mysqlModule.checkCompatibilityVersion = async function (version, callback) {
    if (semver.lt(version, '3.10.2')) {
        return callback(new Error('The `mysql2` package is out-of-date, please run `./nodebb setup` again.'));
    }

    if (callback)
        callback();
};

mysqlModule.info = async function (db) {
    if (!db) {
        db = await connection.connect(nconf.get('mysql'));
    }
    const [rows] = await db.query(`
            SELECT 
            TRUE AS mysql,
            VERSION() AS version,
            (SELECT Variable_value 
            FROM performance_schema.global_status 
            WHERE Variable_name = 'Uptime') * 1000 AS uptime
            `);

    if (mysqlModule.pool !== db)
        connection.close(db);

    return {
        ...rows[0],
        raw: JSON.stringify(rows[0], null, 4),
    };
};

require('./mysql/main')(mysqlModule);
require('./mysql/hash')(mysqlModule);
require('./mysql/sets')(mysqlModule);
require('./mysql/sorted')(mysqlModule);
require('./mysql/transaction')(mysqlModule);
