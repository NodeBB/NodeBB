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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const winston_1 = __importDefault(require("winston"));
const nconf_1 = __importDefault(require("nconf"));
const database_1 = __importDefault(require("../database"));
const batch = require('../batch');
const meta_1 = __importDefault(require("../meta"));
const user = require('./index');
const topics = require('../topics');
const plugins = require('../plugins');
const emailer = require('../emailer');
const utils = require('../utils');
const Digest = {};
const baseUrl = nconf_1.default.get('base_url');
Digest.execute = function (payload) {
    return __awaiter(this, void 0, void 0, function* () {
        const digestsDisabled = meta_1.default.config.disableEmailSubscriptions === 1;
        if (digestsDisabled) {
            winston_1.default.info(`[user/jobs] Did not send digests (${payload.interval}) because subscription system is disabled.`);
            return;
        }
        let { subscribers } = payload;
        if (!subscribers) {
            subscribers = yield Digest.getSubscribers(payload.interval);
        }
        if (!subscribers.length) {
            return;
        }
        try {
            winston_1.default.info(`[user/jobs] Digest (${payload.interval}) scheduling completed (${subscribers.length} subscribers). Sending emails; this may take some time...`);
            yield Digest.send({
                interval: payload.interval,
                subscribers: subscribers,
            });
            winston_1.default.info(`[user/jobs] Digest (${payload.interval}) complete.`);
        }
        catch (err) {
            winston_1.default.error(`[user/jobs] Could not send digests (${payload.interval})\n${err.stack}`);
            throw err;
        }
    });
};
Digest.getUsersInterval = (uids) => __awaiter(void 0, void 0, void 0, function* () {
    // Checks whether user specifies digest setting, or false for system default setting
    let single = false;
    if (!Array.isArray(uids) && !isNaN(parseInt(uids, 10))) {
        uids = [uids];
        single = true;
    }
    const settings = yield database_1.default.getObjects(uids.map(uid => `user:${uid}:settings`));
    const interval = uids.map((uid, index) => (settings[index] && settings[index].dailyDigestFreq) || false);
    return single ? interval[0] : interval;
});
Digest.getSubscribers = function (interval) {
    return __awaiter(this, void 0, void 0, function* () {
        let subscribers = [];
        yield batch.processSortedSet('users:joindate', (uids) => __awaiter(this, void 0, void 0, function* () {
            const settings = yield user.getMultipleUserSettings(uids);
            let subUids = [];
            settings.forEach((hash) => {
                if (hash.dailyDigestFreq === interval) {
                    subUids.push(hash.uid);
                }
            });
            subUids = yield user.bans.filterBanned(subUids);
            subscribers = subscribers.concat(subUids);
        }), {
            interval: 1000,
            batch: 500,
        });
        const results = yield plugins.hooks.fire('filter:digest.subscribers', {
            interval: interval,
            subscribers: subscribers,
        });
        return results.subscribers;
    });
};
Digest.send = function (data) {
    return __awaiter(this, void 0, void 0, function* () {
        let emailsSent = 0;
        if (!data || !data.subscribers || !data.subscribers.length) {
            return emailsSent;
        }
        let errorLogged = false;
        yield batch.processArray(data.subscribers, (uids) => __awaiter(this, void 0, void 0, function* () {
            let userData = yield user.getUsersFields(uids, ['uid', 'email', 'email:confirmed', 'username', 'userslug', 'lastonline']);
            userData = userData.filter(u => u && u.email && (meta_1.default.config.includeUnverifiedEmails || u['email:confirmed']));
            if (!userData.length) {
                return;
            }
            yield Promise.all(userData.map((userObj) => __awaiter(this, void 0, void 0, function* () {
                const [notifications, topics] = yield Promise.all([
                    user.notifications.getUnreadInterval(userObj.uid, data.interval),
                    getTermTopics(data.interval, userObj.uid),
                ]);
                const unreadNotifs = notifications.filter(Boolean);
                // If there are no notifications and no new topics, don't bother sending a digest
                if (!unreadNotifs.length && !topics.top.length && !topics.popular.length && !topics.recent.length) {
                    return;
                }
                unreadNotifs.forEach((n) => {
                    if (n.image && !n.image.startsWith('http')) {
                        n.image = baseUrl + n.image;
                    }
                    if (n.path) {
                        n.notification_url = n.path.startsWith('http') ? n.path : baseUrl + n.path;
                    }
                });
                emailsSent += 1;
                const now = new Date();
                yield emailer.send('digest', userObj.uid, {
                    subject: `[[email:digest.subject, ${now.getFullYear()}/${now.getMonth() + 1}/${now.getDate()}]]`,
                    username: userObj.username,
                    userslug: userObj.userslug,
                    notifications: unreadNotifs,
                    recent: topics.recent,
                    topTopics: topics.top,
                    popularTopics: topics.popular,
                    interval: data.interval,
                    showUnsubscribe: true,
                }).catch((err) => {
                    if (!errorLogged) {
                        winston_1.default.error(`[user/jobs] Could not send digest email\n[emailer.send] ${err.stack}`);
                        errorLogged = true;
                    }
                });
            })));
            if (data.interval !== 'alltime') {
                const now = Date.now();
                yield database_1.default.sortedSetAdd('digest:delivery', userData.map(() => now), userData.map(u => u.uid));
            }
        }), {
            interval: 1000,
            batch: 100,
        });
        winston_1.default.info(`[user/jobs] Digest (${data.interval}) sending completed. ${emailsSent} emails sent.`);
    });
};
Digest.getDeliveryTimes = (start, stop) => __awaiter(void 0, void 0, void 0, function* () {
    const count = yield database_1.default.sortedSetCard('users:joindate');
    const uids = yield user.getUidsFromSet('users:joindate', start, stop);
    if (!uids.length) {
        return [];
    }
    const [scores, settings] = yield Promise.all([
        // Grab the last time a digest was successfully delivered to these uids
        database_1.default.sortedSetScores('digest:delivery', uids),
        // Get users' digest settings
        Digest.getUsersInterval(uids),
    ]);
    // Populate user data
    let userData = yield user.getUsersFields(uids, ['username', 'picture']);
    userData = userData.map((user, idx) => {
        user.lastDelivery = scores[idx] ? new Date(scores[idx]).toISOString() : '[[admin/manage/digest:null]]';
        user.setting = settings[idx];
        return user;
    });
    return {
        users: userData,
        count: count,
    };
});
function getTermTopics(term, uid) {
    return __awaiter(this, void 0, void 0, function* () {
        const data = yield topics.getSortedTopics({
            uid: uid,
            start: 0,
            stop: 199,
            term: term,
            sort: 'votes',
            teaserPost: 'first',
        });
        data.topics = data.topics.filter((topic) => topic && !topic.deleted);
        const top = data.topics.filter((t) => t.votes > 0).slice(0, 10);
        const topTids = top.map((t) => t.tid);
        const popular = data.topics
            .filter((t) => t.postcount > 1 && !topTids.includes(t.tid))
            .sort((a, b) => b.postcount - a.postcount)
            .slice(0, 10);
        const popularTids = popular.map((t) => t.tid);
        const recent = data.topics
            .filter((t) => !topTids.includes(t.tid) && !popularTids.includes(t.tid))
            .sort((a, b) => b.lastposttime - a.lastposttime)
            .slice(0, 10);
        [...top, ...popular, ...recent].forEach((topicObj) => {
            if (topicObj) {
                if (topicObj.teaser && topicObj.teaser.content && topicObj.teaser.content.length > 255) {
                    topicObj.teaser.content = `${topicObj.teaser.content.slice(0, 255)}...`;
                }
                // Fix relative paths in topic data
                const user = topicObj.hasOwnProperty('teaser') && topicObj.teaser && topicObj.teaser.user ?
                    topicObj.teaser.user : topicObj.user;
                if (user && user.picture && utils.isRelativeUrl(user.picture)) {
                    user.picture = baseUrl + user.picture;
                }
            }
        });
        return { top, popular, recent };
    });
}
