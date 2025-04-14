'use strict';

import winston from 'winston';
import LoggerWithIndentation from './LoggerWithIndentation.mjs';
import password from '../src/password.js';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);

let cleanupCalled = false;
async function cleanup() {
    let breakCleanup = false;
    if (cleanupCalled) {
        breakCleanup = true;
    }
    cleanupCalled = true;

    const logger = new LoggerWithIndentation();
    const log = (level) => logger.getLogger(level);
    try {
        log(0).info('starting cleanup');
    } catch (err) {
        winston.error("error creating logger");
        winston.error(err.stack);
        process.exit(1);
    }

    if (breakCleanup) {
        log(0).info('cleanup already called, skipping');
        return;
    }

    try {
        await password.close();
        log(1).info('password workerpool closed');
    } catch (err) {
        log(1).error("error closing password workerpool", err);
    }

    try {
        const webserver = require('../src/webserver.js');
        await webserver.destroy();
        log(1).info('webserver closed');
    } catch (err) {
        log(1).error("error closing webserver", err);
    }

    try {
        const db = require('../src/database/index.js');
        await db.close();
        log(1).info('db closed');
    } catch (err) {
        log(1).error("error closing db", err);
    }

    try {
        const metaErrors = require('../src/meta/errors.js');
        metaErrors.stop();
        log(1).info('cron jobs stopped for errors');
    } catch (err) {
        log(1).error("error stopping cron jobs for errors", err);
    }

    try {
        const analytics = require('../src/analytics.js');
        analytics.stop();
        log(1).info('cron jobs stopped for analytics');
    } catch (err) {
        log(1).error("error stopping analytics", err);
    }

    try {
        const notifications = require('../src/notifications.js');
        notifications.stop();
        log(1).info('cron jobs stopped for notifications');
    } catch (err) {
        log(1).error("error stopping notifications", err);
    }

    try {
        const activitypub = require('../src/activitypub/index.js');
        activitypub.stop();
        log(1).info('cron jobs stopped for activitypub');
    } catch (err) {
        log(1).error("error stopping activitypub", err);
    }

    try {
        const plugins = require('../src/plugins/index.js');
        plugins.stop();
        log(1).info('cron jobs stopped for plugins');
    } catch (err) {
        log(1).error("error stopping plugins", err);
    }

    try {
        const posts = require('../src/posts/index.js');
        posts.stop();
        log(1).info('cron jobs stopped for posts');
    } catch (err) {
        log(1).error("error stopping posts", err);
    }

    try {
        const scheduledTopics = require('../src/topics/scheduled.js');
        scheduledTopics.stop();
        log(1).info('cron jobs stopped for scheduled topics');
    } catch (err) {
        log(1).error("error stopping scheduled topics", err);
    }

    try {
        const User = require('../src/user/index.js');
        User.stop();
        User.stopJobs();
        log(1).info('cron jobs stopped for user');
    } catch (err) {
        log(1).error("error stopping user", err);
    }

    log(0).info('cleanup complete');
}

function cleanupSync() {
    (async () => await cleanup())();
};

process.on('SIGINT', () => {
    console.log('Received SIGINT, cleaning up...');
    cleanupSync();
});
process.on('SIGTERM', () => {
    console.log('Received SIGTERM, cleaning up...');
    cleanupSync();
});
process.on('exit', () => {
    console.log('Process exiting, cleaning up...');
    cleanupSync();
});

after(async function cleanupWrapper() {
    console.log('afterAll hook triggered, cleaning up...');
    await cleanup();
});
