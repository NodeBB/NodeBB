'use strict';

const winston = require('winston');

const { DateTime } = require('luxon');
const createLoggerInherited = (indent) => {
    const indentString = '\t'.repeat(indent);
    const tabFormat = winston.format.printf(({ level, message, timestamp }) => `${indentString}${timestamp} [${level}] ${message}`);
    const formats = [
        winston.format.timestamp({
            format: () => DateTime.now().toISO()
        }),
        winston.format.errors({ stack: true }),
        winston.format.splat(),
        tabFormat
    ];
    if (process.stdout.isTTY) {
        formats.unshift(winston.format.colorize());
    }
    return winston.createLogger({
        format: winston.format.combine(...formats),
        transports: [new winston.transports.Console()]
    });
};

/**
 * @typedef {import('winston').Logger} Logger
 * @typedef {Map<number, Logger>} Loggers
 */
/**
 * Map of loggers with different indentation levels
 * @type {Loggers}
 */
const loggers = new Map();

const log = (/**@type {number}*/ indent) => {
    // Create a logger with the specified indentation
    let logger = loggers.get(indent);
    if (!logger) {
        logger = createLoggerInherited(indent);
        loggers.set(indent, logger);
    }
    return logger;
};

const cleanupLoggers = () => {
    loggers.clear();
}

// cleanup
after(async function cleanup() {
    // Cleanup loggers
    cleanupLoggers();
    log(0).info('starting cleanup');

    try {
        const password = require('../src/password');
        await password.close();
        log(1).info('password workerpool closed');
    }
    catch (err) {
        log(1).error("error closing password workerpool");
        log(1).error(err);
    }

    try {
        const webserver = require('../src/webserver');
        await webserver.destroy();
        log(1).info('webserver closed');
    } catch (err) {
        log(1).error("error closing webserver");
        log(1).error(err);
    }

    try {
        const db = require('../src/database');
        await db.close();
        log(1).info('db closed');

        require('../src/meta/errors').stop();
        log(1).info('cron jobs stopped for errors');
    } catch (err) {
        log(1).error("error closing db");
        log(1).error(err);
    }

    try {
        require('../src/analytics').stop();
        log(1).info('cron jobs stopped for analytics');
    }
    catch (err) {
        log(1).error("error stopping analytics");
        log(1).error(err);
    }

    try {
        require('../src/notifications').stop();
        log(1).info('cron jobs stopped for notifications');
    }
    catch (err) {
        log(1).error("error stopping notifications");
        log(1).error(err);
    }

    try {
        require('../src/activitypub').stop();
        log(1).info('cron jobs stopped for activitypub');
    } catch (err) {
        log(1).error("error stopping activitypub");
        log(1).error(err);
    }

    try {
        require('../src/plugins').stop();
        log(1).info('cron jobs stopped for plugins');
    } catch (err) {
        log(1).error("error stopping plugins");
        log(1).error(err);
    }

    try {
        require('../src/posts').stop();
        log(1).info('cron jobs stopped for posts');
    } catch (err) {
        log(1).error("error stopping posts");
        log(1).error(err);
    }

    try {
        require('../src/topics/scheduled').stop();
        log(1).info('cron jobs stopped for scheduled topics');
    } catch (err) {
        log(1).error("error stopping scheduled topics");
        log(1).error(err);
    }

    try {
        const User = require('../src/user');
        User.stop();
        User.stopJobs();
        log(1).info('cron jobs stopped for user');
    } catch (err) {
        log(1).error("error stopping user");
        log(1).error(err);
    }

    log(0).info('cleanup complete');
});
