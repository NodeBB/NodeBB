'use strict';

const mysql = require('mysql2/promise');
const nconf = require('nconf');
const winston = require('winston');
const _ = require('lodash');

const connection = module.exports;

connection.getConnectionConfig = function (mysqlConfig) {
    mysqlConfig = mysqlConfig || nconf.get('mysql');
    const config = {
        host: mysqlConfig.host || '127.0.0.1',
        port: mysqlConfig.port || 3306,
        user: mysqlConfig.user || 'root',
        password: mysqlConfig.password || '',
        database: mysqlConfig.database || 'nodebb',
        connectionLimit: mysqlConfig.connectionLimit || 10,
    };

    if (!mysqlConfig.database) {
        winston.warn('You have no database name set, using "nodebb" as default.');
    }

    return config;
};

connection.connect = async function (mysqlConfig) {
    const config = connection.getConnectionConfig(mysqlConfig);

    try {
        const pool = mysql.createPool(config);
        winston.verbose('[mysql] Successfully connected to MySQL database.');
        return pool;
    } catch (err) {
        winston.error('[mysql] Error connecting to MySQL:', err.message);
        throw err;
    }
};

/**
 * 
 * @param {import('mysql2/promise').Pool} pool 
 */
connection.close = async function (pool) {
    if (pool) {
        try {
            await pool.end();
            winston.verbose('[mysql] MySQL connection pool closed.');
        } catch (err) {
            winston.error('[mysql] Error closing MySQL connection pool');
            winston.error(err.stack);
            throw err;
        }
    }
};