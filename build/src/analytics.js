'use strict';
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const cronJob = require('cron').CronJob;
const winston_1 = __importDefault(require("winston"));
const nconf_1 = __importDefault(require("nconf"));
const crypto = require('crypto');
const util = require('util');
const _ = require('lodash');
const sleep = util.promisify(setTimeout);
const database = __importStar(require("./database"));
const db = database;
const utils = require('./utils');
const plugins = require('./plugins');
const meta = require('./meta');
const pubsub = require('./pubsub');
const cacheCreate = require('./cache/lru').default;
const Analytics = {};
const secret = nconf_1.default.get('secret');
let local = {
    counters: {},
    pageViews: 0,
    pageViewsRegistered: 0,
    pageViewsGuest: 0,
    pageViewsBot: 0,
    uniqueIPCount: 0,
    uniquevisitors: 0,
};
const empty = _.cloneDeep(local);
const total = _.cloneDeep(local);
let ipCache;
const runJobs = nconf_1.default.get('runJobs');
Analytics.init = function () {
    return __awaiter(this, void 0, void 0, function* () {
        ipCache = cacheCreate({
            max: parseInt(meta.config['analytics:maxCache'], 10) || 500,
            ttl: 0,
        });
        new cronJob('*/10 * * * * *', (() => __awaiter(this, void 0, void 0, function* () {
            publishLocalAnalytics();
            if (runJobs) {
                yield sleep(2000);
                yield Analytics.writeData();
            }
        })), null, true);
        if (runJobs) {
            pubsub.on('analytics:publish', (data) => {
                incrementProperties(total, data.local);
            });
        }
    });
};
function publishLocalAnalytics() {
    pubsub.publish('analytics:publish', {
        local: local,
    });
    local = _.cloneDeep(empty);
}
function incrementProperties(obj1, obj2) {
    for (const [key, value] of Object.entries(obj2)) {
        if (typeof value === 'object') {
            incrementProperties(obj1[key], value);
        }
        else if (utils.isNumber(value)) {
            obj1[key] = obj1[key] || 0;
            obj1[key] += obj2[key];
        }
    }
}
Analytics.increment = function (keys, callback) {
    keys = Array.isArray(keys) ? keys : [keys];
    plugins.hooks.fire('action:analytics.increment', { keys: keys });
    keys.forEach((key) => {
        local.counters[key] = local.counters[key] || 0;
        local.counters[key] += 1;
    });
    if (typeof callback === 'function') {
        callback();
    }
};
Analytics.getKeys = () => __awaiter(void 0, void 0, void 0, function* () { return db.getSortedSetRange('analyticsKeys', 0, -1); });
Analytics.pageView = function (payload) {
    return __awaiter(this, void 0, void 0, function* () {
        local.pageViews += 1;
        if (payload.uid > 0) {
            local.pageViewsRegistered += 1;
        }
        else if (payload.uid < 0) {
            local.pageViewsBot += 1;
        }
        else {
            local.pageViewsGuest += 1;
        }
        if (payload.ip) {
            // Retrieve hash or calculate if not present
            let hash = ipCache.get(payload.ip + secret);
            if (!hash) {
                hash = crypto.createHash('sha1').update(payload.ip + secret).digest('hex');
                ipCache.set(payload.ip + secret, hash);
            }
            // @ts-ignore
            const score = yield db.sortedSetScore('ip:recent', hash);
            if (!score) {
                local.uniqueIPCount += 1;
            }
            const today = new Date();
            today.setHours(today.getHours(), 0, 0, 0);
            if (!score || score < today.getTime()) {
                local.uniquevisitors += 1;
                // @ts-ignore
                yield db.sortedSetAdd('ip:recent', Date.now(), hash);
            }
        }
    });
};
Analytics.writeData = function () {
    return __awaiter(this, void 0, void 0, function* () {
        const today = new Date();
        const month = new Date();
        const dbQueue = [];
        const incrByBulk = [];
        // Build list of metrics that were updated
        let metrics = [
            'pageviews',
            'pageviews:month',
        ];
        metrics.forEach((metric) => {
            const toAdd = ['registered', 'guest', 'bot'].map(type => `${metric}:${type}`);
            metrics = [...metrics, ...toAdd];
        });
        metrics.push('uniquevisitors');
        today.setHours(today.getHours(), 0, 0, 0);
        month.setMonth(month.getMonth(), 1);
        month.setHours(0, 0, 0, 0);
        if (total.pageViews > 0) {
            incrByBulk.push(['analytics:pageviews', total.pageViews, today.getTime()]);
            incrByBulk.push(['analytics:pageviews:month', total.pageViews, month.getTime()]);
            total.pageViews = 0;
        }
        if (total.pageViewsRegistered > 0) {
            incrByBulk.push(['analytics:pageviews:registered', total.pageViewsRegistered, today.getTime()]);
            incrByBulk.push(['analytics:pageviews:month:registered', total.pageViewsRegistered, month.getTime()]);
            total.pageViewsRegistered = 0;
        }
        if (total.pageViewsGuest > 0) {
            incrByBulk.push(['analytics:pageviews:guest', total.pageViewsGuest, today.getTime()]);
            incrByBulk.push(['analytics:pageviews:month:guest', total.pageViewsGuest, month.getTime()]);
            total.pageViewsGuest = 0;
        }
        if (total.pageViewsBot > 0) {
            incrByBulk.push(['analytics:pageviews:bot', total.pageViewsBot, today.getTime()]);
            incrByBulk.push(['analytics:pageviews:month:bot', total.pageViewsBot, month.getTime()]);
            total.pageViewsBot = 0;
        }
        if (total.uniquevisitors > 0) {
            incrByBulk.push(['analytics:uniquevisitors', total.uniquevisitors, today.getTime()]);
            total.uniquevisitors = 0;
        }
        if (total.uniqueIPCount > 0) {
            dbQueue.push(db.incrObjectFieldBy('global', 'uniqueIPCount', total.uniqueIPCount));
            total.uniqueIPCount = 0;
        }
        for (const [key, value] of Object.entries(total.counters)) {
            incrByBulk.push([`analytics:${key}`, value, today.getTime()]);
            metrics.push(key);
            delete total.counters[key];
        }
        if (incrByBulk.length) {
            dbQueue.push(db.sortedSetIncrByBulk(incrByBulk));
        }
        // Update list of tracked metrics
        dbQueue.push(db.sortedSetAdd('analyticsKeys', metrics.map(() => +Date.now()), metrics));
        try {
            yield Promise.all(dbQueue);
        }
        catch (err) {
            winston_1.default.error(`[analytics] Encountered error while writing analytics to data store\n${err.stack}`);
        }
    });
};
Analytics.getHourlyStatsForSet = function (set, hour, numHours) {
    return __awaiter(this, void 0, void 0, function* () {
        // Guard against accidental ommission of `analytics:` prefix
        if (!set.startsWith('analytics:')) {
            set = `analytics:${set}`;
        }
        const terms = {};
        const hoursArr = [];
        hour = new Date(hour);
        hour.setHours(hour.getHours(), 0, 0, 0);
        for (let i = 0, ii = numHours; i < ii; i += 1) {
            hoursArr.push(hour.getTime() - (i * 3600 * 1000));
        }
        const counts = yield db.sortedSetScores(set, hoursArr);
        hoursArr.forEach((term, index) => {
            terms[term] = parseInt(counts[index], 10) || 0;
        });
        const termsArr = [];
        hoursArr.reverse();
        hoursArr.forEach((hour) => {
            termsArr.push(terms[hour]);
        });
        return termsArr;
    });
};
Analytics.getDailyStatsForSet = function (set, day, numDays) {
    return __awaiter(this, void 0, void 0, function* () {
        // Guard against accidental ommission of `analytics:` prefix
        if (!set.startsWith('analytics:')) {
            set = `analytics:${set}`;
        }
        const daysArr = [];
        day = new Date(day);
        // set the date to tomorrow, because getHourlyStatsForSet steps *backwards* 24 hours to sum up the values
        day.setDate(day.getDate() + 1);
        day.setHours(0, 0, 0, 0);
        while (numDays > 0) {
            /* eslint-disable no-await-in-loop */
            const dayData = yield Analytics.getHourlyStatsForSet(set, day.getTime() - (1000 * 60 * 60 * 24 * (numDays - 1)), 24);
            daysArr.push(dayData.reduce((cur, next) => cur + next));
            numDays -= 1;
        }
        return daysArr;
    });
};
Analytics.getUnwrittenPageviews = function () {
    return local.pageViews;
};
Analytics.getSummary = function () {
    return __awaiter(this, void 0, void 0, function* () {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const [seven, thirty] = yield Promise.all([
            Analytics.getDailyStatsForSet('analytics:pageviews', today, 7),
            Analytics.getDailyStatsForSet('analytics:pageviews', today, 30),
        ]);
        return {
            seven: seven.reduce((sum, cur) => sum + cur, 0),
            thirty: thirty.reduce((sum, cur) => sum + cur, 0),
        };
    });
};
Analytics.getCategoryAnalytics = function (cid) {
    return __awaiter(this, void 0, void 0, function* () {
        return yield utils.promiseParallel({
            'pageviews:hourly': Analytics.getHourlyStatsForSet(`analytics:pageviews:byCid:${cid}`, Date.now(), 24),
            'pageviews:daily': Analytics.getDailyStatsForSet(`analytics:pageviews:byCid:${cid}`, Date.now(), 30),
            'topics:daily': Analytics.getDailyStatsForSet(`analytics:topics:byCid:${cid}`, Date.now(), 7),
            'posts:daily': Analytics.getDailyStatsForSet(`analytics:posts:byCid:${cid}`, Date.now(), 7),
        });
    });
};
Analytics.getErrorAnalytics = function () {
    return __awaiter(this, void 0, void 0, function* () {
        return yield utils.promiseParallel({
            'not-found': Analytics.getDailyStatsForSet('analytics:errors:404', Date.now(), 7),
            toobusy: Analytics.getDailyStatsForSet('analytics:errors:503', Date.now(), 7),
        });
    });
};
Analytics.getBlacklistAnalytics = function () {
    return __awaiter(this, void 0, void 0, function* () {
        return yield utils.promiseParallel({
            daily: Analytics.getDailyStatsForSet('analytics:blacklist', Date.now(), 7),
            hourly: Analytics.getHourlyStatsForSet('analytics:blacklist', Date.now(), 24),
        });
    });
};
require('./promisify').promisify(Analytics);
