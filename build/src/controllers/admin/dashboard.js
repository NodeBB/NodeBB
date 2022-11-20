'use strict';
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __rest = (this && this.__rest) || function (s, e) {
    var t = {};
    for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p) && e.indexOf(p) < 0)
        t[p] = s[p];
    if (s != null && typeof Object.getOwnPropertySymbols === "function")
        for (var i = 0, p = Object.getOwnPropertySymbols(s); i < p.length; i++) {
            if (e.indexOf(p[i]) < 0 && Object.prototype.propertyIsEnumerable.call(s, p[i]))
                t[p[i]] = s[p[i]];
        }
    return t;
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const nconf_1 = __importDefault(require("nconf"));
const semver = require('semver');
const winston_1 = __importDefault(require("winston"));
const _ = require('lodash');
const validator = require('validator');
const versions = require('../../admin/versions');
const database_1 = __importDefault(require("../../database"));
const meta_1 = __importDefault(require("../../meta"));
const analytics = require('../../analytics');
const plugins = require('../../plugins');
const user_1 = __importDefault(require("../../user"));
const topics = require('../../topics');
const utils = require('../../utils');
const emailer = require('../../emailer');
const dashboardController = {};
dashboardController.get = function (req, res) {
    return __awaiter(this, void 0, void 0, function* () {
        const [stats, notices, latestVersion, lastrestart, isAdmin, popularSearches] = yield Promise.all([
            getStats(),
            getNotices(),
            getLatestVersion(),
            getLastRestart(),
            user_1.default.isAdministrator(req.uid),
            getPopularSearches(),
        ]);
        const version = nconf_1.default.get('version');
        res.render('admin/dashboard', {
            version: version,
            lookupFailed: latestVersion === null,
            latestVersion: latestVersion,
            upgradeAvailable: latestVersion && semver.gt(latestVersion, version),
            currentPrerelease: versions.isPrerelease.test(version),
            notices: notices,
            stats: stats,
            canRestart: !!process.send,
            lastrestart: lastrestart,
            showSystemControls: isAdmin,
            popularSearches: popularSearches,
        });
    });
};
function getNotices() {
    return __awaiter(this, void 0, void 0, function* () {
        const notices = [
            {
                done: !meta_1.default.reloadRequired,
                doneText: '[[admin/dashboard:restart-not-required]]',
                notDoneText: '[[admin/dashboard:restart-required]]',
            },
            {
                done: plugins.hooks.hasListeners('filter:search.query'),
                doneText: '[[admin/dashboard:search-plugin-installed]]',
                notDoneText: '[[admin/dashboard:search-plugin-not-installed]]',
                tooltip: '[[admin/dashboard:search-plugin-tooltip]]',
                link: '/admin/extend/plugins',
            },
        ];
        if (emailer.fallbackNotFound) {
            notices.push({
                done: false,
                notDoneText: '[[admin/dashboard:fallback-emailer-not-found]]',
            });
        }
        if (global.env !== 'production') {
            notices.push({
                done: false,
                notDoneText: '[[admin/dashboard:running-in-development]]',
            });
        }
        return yield plugins.hooks.fire('filter:admin.notices', notices);
    });
}
function getLatestVersion() {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            return yield versions.getLatestVersion();
        }
        catch (err) {
            winston_1.default.error(`[acp] Failed to fetch latest version\n${err.stack}`);
        }
        return null;
    });
}
dashboardController.getAnalytics = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    // Basic validation
    const validUnits = ['days', 'hours'];
    const validSets = ['uniquevisitors', 'pageviews', 'pageviews:registered', 'pageviews:bot', 'pageviews:guest'];
    const until = req.query.until ? new Date(parseInt(req.query.until, 10)) : Date.now();
    const count = req.query.count || (req.query.units === 'hours' ? 24 : 30);
    if (isNaN(until) || !validUnits.includes(req.query.units)) {
        return next(new Error('[[error:invalid-data]]'));
    }
    // Filter out invalid sets, if no sets, assume all sets
    let sets;
    if (req.query.sets) {
        sets = Array.isArray(req.query.sets) ? req.query.sets : [req.query.sets];
        sets = sets.filter((set) => validSets.includes(set));
    }
    else {
        sets = validSets;
    }
    const method = req.query.units === 'days' ? analytics.getDailyStatsForSet : analytics.getHourlyStatsForSet;
    let payload = yield Promise.all(sets.map((set) => method(`analytics:${set}`, until, count)));
    payload = _.zipObject(sets, payload);
    res.json({
        query: {
            set: req.query.set,
            units: req.query.units,
            until: until,
            count: count,
        },
        result: payload,
    });
});
function getStats() {
    return __awaiter(this, void 0, void 0, function* () {
        const cache = require('../../cache');
        const cachedStats = cache.get('admin:stats');
        if (cachedStats !== undefined) {
            return cachedStats;
        }
        let results = yield Promise.all([
            getStatsForSet('ip:recent', 'uniqueIPCount'),
            getStatsFromAnalytics('logins', 'loginCount'),
            getStatsForSet('users:joindate', 'userCount'),
            getStatsForSet('posts:pid', 'postCount'),
            getStatsForSet('topics:tid', 'topicCount'),
        ]);
        results[0].name = '[[admin/dashboard:unique-visitors]]';
        results[1].name = '[[admin/dashboard:logins]]';
        results[1].href = `${nconf_1.default.get('relative_path')}/admin/dashboard/logins`;
        results[2].name = '[[admin/dashboard:new-users]]';
        results[2].href = `${nconf_1.default.get('relative_path')}/admin/dashboard/users`;
        results[3].name = '[[admin/dashboard:posts]]';
        results[4].name = '[[admin/dashboard:topics]]';
        results[4].href = `${nconf_1.default.get('relative_path')}/admin/dashboard/topics`;
        ({ results } = yield plugins.hooks.fire('filter:admin.getStats', {
            results,
            helpers: { getStatsForSet, getStatsFromAnalytics },
        }));
        cache.set('admin:stats', results, 600000);
        return results;
    });
}
function getStatsForSet(set, field) {
    return __awaiter(this, void 0, void 0, function* () {
        const terms = {
            day: 86400000,
            week: 604800000,
            month: 2592000000,
        };
        const now = Date.now();
        const results = yield utils.promiseParallel({
            yesterday: database_1.default.sortedSetCount(set, now - (terms.day * 2), '+inf'),
            today: database_1.default.sortedSetCount(set, now - terms.day, '+inf'),
            lastweek: database_1.default.sortedSetCount(set, now - (terms.week * 2), '+inf'),
            thisweek: database_1.default.sortedSetCount(set, now - terms.week, '+inf'),
            lastmonth: database_1.default.sortedSetCount(set, now - (terms.month * 2), '+inf'),
            thismonth: database_1.default.sortedSetCount(set, now - terms.month, '+inf'),
            alltime: getGlobalField(field),
        });
        return calculateDeltas(results);
    });
}
function getStatsFromAnalytics(set, field) {
    return __awaiter(this, void 0, void 0, function* () {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const data = yield analytics.getDailyStatsForSet(`analytics:${set}`, today, 60);
        const sum = (arr) => arr.reduce((memo, cur) => memo + cur, 0);
        const results = {
            yesterday: sum(data.slice(-2)),
            today: data.slice(-1)[0],
            lastweek: sum(data.slice(-14)),
            thisweek: sum(data.slice(-7)),
            lastmonth: sum(data.slice(0)),
            thismonth: sum(data.slice(-30)),
            alltime: yield getGlobalField(field),
        };
        return calculateDeltas(results);
    });
}
function calculateDeltas(results) {
    function textClass(num) {
        if (num > 0) {
            return 'text-success';
        }
        else if (num < 0) {
            return 'text-danger';
        }
        return 'text-warning';
    }
    function increasePercent(last, now) {
        const percent = last ? (now - last) / last * 100 : 0;
        return percent.toFixed(1);
    }
    results.yesterday -= results.today;
    results.dayIncrease = increasePercent(results.yesterday, results.today);
    results.dayTextClass = textClass(results.dayIncrease);
    results.lastweek -= results.thisweek;
    results.weekIncrease = increasePercent(results.lastweek, results.thisweek);
    results.weekTextClass = textClass(results.weekIncrease);
    results.lastmonth -= results.thismonth;
    results.monthIncrease = increasePercent(results.lastmonth, results.thismonth);
    results.monthTextClass = textClass(results.monthIncrease);
    return results;
}
function getGlobalField(field) {
    return __awaiter(this, void 0, void 0, function* () {
        const count = yield database_1.default.getObjectField('global', field);
        return parseInt(count, 10) || 0;
    });
}
function getLastRestart() {
    return __awaiter(this, void 0, void 0, function* () {
        const lastrestart = yield database_1.default.getObject('lastrestart');
        if (!lastrestart) {
            return null;
        }
        const userData = yield user_1.default.getUserData(lastrestart.uid);
        lastrestart.user = userData;
        lastrestart.timestampISO = utils.toISOString(lastrestart.timestamp);
        return lastrestart;
    });
}
function getPopularSearches() {
    return __awaiter(this, void 0, void 0, function* () {
        const searches = yield database_1.default.getSortedSetRevRangeWithScores('searches:all', 0, 9);
        return searches.map((s) => ({ value: validator.escape(String(s.value)), score: s.score }));
    });
}
dashboardController.getLogins = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    let stats = yield getStats();
    stats = stats.filter((stat) => stat.name === '[[admin/dashboard:logins]]').map((_a) => {
        var stat = __rest(_a, []);
        delete stat.href;
        return stat;
    });
    const summary = {
        day: stats[0].today,
        week: stats[0].thisweek,
        month: stats[0].thismonth,
    };
    // List recent sessions
    const start = Date.now() - (1000 * 60 * 60 * 24 * meta_1.default.config.loginDays);
    const uids = yield database_1.default.getSortedSetRangeByScore('users:online', 0, 500, start, Date.now());
    const usersData = yield user_1.default.getUsersData(uids);
    let sessions = yield Promise.all(uids.map((uid) => __awaiter(void 0, void 0, void 0, function* () {
        const sessions = yield user_1.default.auth.getSessions(uid);
        sessions.forEach((session) => {
            session.user = usersData[uids.indexOf(uid)];
        });
        return sessions;
    })));
    sessions = _.flatten(sessions).sort((a, b) => b.datetime - a.datetime);
    res.render('admin/dashboard/logins', {
        set: 'logins',
        query: req.query,
        stats,
        summary,
        sessions,
        loginDays: meta_1.default.config.loginDays,
    });
});
dashboardController.getUsers = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    let stats = yield getStats();
    stats = stats.filter((stat) => stat.name === '[[admin/dashboard:new-users]]').map((_a) => {
        var stat = __rest(_a, []);
        delete stat.href;
        return stat;
    });
    const summary = {
        day: stats[0].today,
        week: stats[0].thisweek,
        month: stats[0].thismonth,
    };
    // List of users registered within time frame
    const end = parseInt(req.query.until, 10) || Date.now();
    const start = end - (1000 * 60 * 60 * (req.query.units === 'days' ? 24 : 1) * (req.query.count || (req.query.units === 'days' ? 30 : 24)));
    const uids = yield database_1.default.getSortedSetRangeByScore('users:joindate', 0, 500, start, end);
    const users = yield user_1.default.getUsersData(uids);
    res.render('admin/dashboard/users', {
        set: 'registrations',
        query: req.query,
        stats,
        summary,
        users,
    });
});
dashboardController.getTopics = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    let stats = yield getStats();
    stats = stats.filter((stat) => stat.name === '[[admin/dashboard:topics]]').map((_a) => {
        var stat = __rest(_a, []);
        delete stat.href;
        return stat;
    });
    const summary = {
        day: stats[0].today,
        week: stats[0].thisweek,
        month: stats[0].thismonth,
    };
    // List of topics created within time frame
    const end = parseInt(req.query.until, 10) || Date.now();
    const start = end - (1000 * 60 * 60 * (req.query.units === 'days' ? 24 : 1) * (req.query.count || (req.query.units === 'days' ? 30 : 24)));
    const tids = yield database_1.default.getSortedSetRangeByScore('topics:tid', 0, 500, start, end);
    const topicData = yield topics.getTopicsByTids(tids);
    res.render('admin/dashboard/topics', {
        set: 'topics',
        query: req.query,
        stats,
        summary,
        topics: topicData,
    });
});
dashboardController.getSearches = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const searches = yield database_1.default.getSortedSetRevRangeWithScores('searches:all', 0, 99);
    res.render('admin/dashboard/searches', {
        searches: searches.map((s) => ({ value: validator.escape(String(s.value)), score: s.score })),
    });
});
