'use strict';

let cleanupCalled = false;
async function cleanup() {
    let breakCleanup = false;
    if (cleanupCalled) {
        breakCleanup = true;
    }
    cleanupCalled = true;

    const LoggerWithIndentation = (await import('./LoggerWithIndentation.mjs')).default;
    const logger = new LoggerWithIndentation();
    const log = (level) => logger.getLogger(level);
    try {
        log(0).info('starting cleanup');
    } catch (err) {
        const winston = (await import('winston')).default;
        winston.error("error creating logger");
        winston.error(err.stack);
        process.exit(1);
    }

    if (breakCleanup) {
        log(0).info('cleanup already called, skipping');
        return;
    }

    try {
        const password = (await import('../src/password.js')).default;
        await password.close();
        log(1).info('password workerpool closed');
    } catch (err) {
        log(1).error("error closing password workerpool", err);
    }

    try {
        const webserver = (await import('../src/webserver.js')).default;
        await webserver.destroy();
        log(1).info('webserver closed');
    } catch (err) {
        log(1).error("error closing webserver", err);
    }

    try {
        const db = (await import('../src/database/index.js')).default;
        await db.close();
        log(1).info('db closed');
    } catch (err) {
        log(1).error("error closing db", err);
    }

    try {
        const metaErrors = (await import('../src/meta/errors.js')).default;
        metaErrors.stop();
        log(1).info('cron jobs stopped for errors');
    } catch (err) {
        log(1).error("error stopping cron jobs for errors", err);
    }

    try {
        const analytics = (await import('../src/analytics.js')).default;
        analytics.stop();
        log(1).info('cron jobs stopped for analytics');
    } catch (err) {
        log(1).error("error stopping analytics", err);
    }

    try {
        const notifications = (await import('../src/notifications.js')).default;
        notifications.stop();
        log(1).info('cron jobs stopped for notifications');
    } catch (err) {
        log(1).error("error stopping notifications", err);
    }

    try {
        const activitypub = (await import('../src/activitypub/index.js')).default;
        activitypub.stop();
        log(1).info('cron jobs stopped for activitypub');
    } catch (err) {
        log(1).error("error stopping activitypub", err);
    }

    try {
        const plugins = (await import('../src/plugins/index.js')).default;
        plugins.stop();
        log(1).info('cron jobs stopped for plugins');
    } catch (err) {
        log(1).error("error stopping plugins", err);
    }

    try {
        const posts = (await import('../src/posts/index.js')).default;
        posts.stop();
        log(1).info('cron jobs stopped for posts');
    } catch (err) {
        log(1).error("error stopping posts", err);
    }

    try {
        const scheduledTopics = (await import('../src/topics/scheduled.js')).default;
        scheduledTopics.stop();
        log(1).info('cron jobs stopped for scheduled topics');
    } catch (err) {
        log(1).error("error stopping scheduled topics", err);
    }

    try {
        const User = (await import('../src/user/index.js')).default;
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
