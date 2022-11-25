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
const async = require('async');
const winston_1 = __importDefault(require("winston"));
const cron = require('cron').CronJob;
const nconf_1 = __importDefault(require("nconf"));
const _ = require('lodash');
const database = __importStar(require("./database"));
const db = database;
const User = require('./user');
const posts = require('./posts');
const groups = require('./groups');
const meta = require('./meta');
const batch = require('./batch');
const plugins = require('./plugins');
const utils = require('./utils');
const emailer = require('./emailer');
const Notifications = {};
Notifications.baseTypes = [
    'notificationType_upvote',
    'notificationType_new-topic',
    'notificationType_new-reply',
    'notificationType_post-edit',
    'notificationType_follow',
    'notificationType_new-chat',
    'notificationType_new-group-chat',
    'notificationType_group-invite',
    'notificationType_group-leave',
    'notificationType_group-request-membership',
];
Notifications.privilegedTypes = [
    'notificationType_new-register',
    'notificationType_post-queue',
    'notificationType_new-post-flag',
    'notificationType_new-user-flag',
];
const notificationPruneCutoff = 2592000000; // one month
Notifications.getAllNotificationTypes = function () {
    return __awaiter(this, void 0, void 0, function* () {
        const results = yield plugins.hooks.fire('filter:user.notificationTypes', {
            types: Notifications.baseTypes.slice(),
            privilegedTypes: Notifications.privilegedTypes.slice(),
        });
        return results.types.concat(results.privilegedTypes);
    });
};
Notifications.startJobs = function () {
    winston_1.default.verbose('[notifications.init] Registering jobs.');
    new cron('*/30 * * * *', Notifications.prune, null, true);
};
Notifications.get = function (nid) {
    return __awaiter(this, void 0, void 0, function* () {
        const notifications = yield Notifications.getMultiple([nid]);
        return Array.isArray(notifications) && notifications.length ? notifications[0] : null;
    });
};
Notifications.getMultiple = function (nids) {
    return __awaiter(this, void 0, void 0, function* () {
        if (!Array.isArray(nids) || !nids.length) {
            return [];
        }
        const keys = nids.map(nid => `notifications:${nid}`);
        const notifications = yield db.getObjects(keys);
        const userKeys = notifications.map(n => n && n.from);
        const usersData = yield User.getUsersFields(userKeys, ['username', 'userslug', 'picture']);
        notifications.forEach((notification, index) => {
            if (notification) {
                if (notification.path && !notification.path.startsWith('http')) {
                    notification.path = nconf_1.default.get('relative_path') + notification.path;
                }
                notification.datetimeISO = utils.toISOString(notification.datetime);
                if (notification.bodyLong) {
                    notification.bodyLong = utils.stripHTMLTags(notification.bodyLong, ['img', 'p', 'a']);
                }
                notification.user = usersData[index];
                if (notification.user) {
                    notification.image = notification.user.picture || null;
                    if (notification.user.username === '[[global:guest]]') {
                        notification.bodyShort = notification.bodyShort.replace(/([\s\S]*?),[\s\S]*?,([\s\S]*?)/, '$1, [[global:guest]], $2');
                    }
                }
                else if (notification.image === 'brand:logo' || !notification.image) {
                    notification.image = meta.config['brand:logo'] || `${nconf_1.default.get('relative_path')}/logo.png`;
                }
            }
        });
        return notifications;
    });
};
Notifications.filterExists = function (nids) {
    return __awaiter(this, void 0, void 0, function* () {
        const exists = yield db.isSortedSetMembers('notifications', nids);
        return nids.filter((nid, idx) => exists[idx]);
    });
};
Notifications.findRelated = function (mergeIds, set) {
    return __awaiter(this, void 0, void 0, function* () {
        mergeIds = mergeIds.filter(Boolean);
        if (!mergeIds.length) {
            return [];
        }
        // A related notification is one in a zset that has the same mergeId
        const nids = yield db.getSortedSetRevRange(set, 0, -1);
        const keys = nids.map(nid => `notifications:${nid}`);
        const notificationData = yield db.getObjectsFields(keys, ['mergeId']);
        const notificationMergeIds = notificationData.map(notifObj => String(notifObj.mergeId));
        const mergeSet = new Set(mergeIds.map(id => String(id)));
        return nids.filter((nid, idx) => mergeSet.has(notificationMergeIds[idx]));
    });
};
Notifications.create = function (data) {
    return __awaiter(this, void 0, void 0, function* () {
        if (!data.nid) {
            throw new Error('[[error:no-notification-id]]');
        }
        data.importance = data.importance || 5;
        const oldNotif = yield db.getObject(`notifications:${data.nid}`);
        if (oldNotif &&
            parseInt(oldNotif.pid, 10) === parseInt(data.pid, 10) &&
            parseInt(oldNotif.importance, 10) > parseInt(data.importance, 10)) {
            return null;
        }
        const now = Date.now();
        data.datetime = now;
        const result = yield plugins.hooks.fire('filter:notifications.create', {
            data: data,
        });
        if (!result.data) {
            return null;
        }
        yield Promise.all([
            db.sortedSetAdd('notifications', now, data.nid),
            db.setObject(`notifications:${data.nid}`, data),
        ]);
        return data;
    });
};
Notifications.push = function (notification, uids) {
    return __awaiter(this, void 0, void 0, function* () {
        if (!notification || !notification.nid) {
            return;
        }
        uids = Array.isArray(uids) ? _.uniq(uids) : [uids];
        if (!uids.length) {
            return;
        }
        setTimeout(() => {
            batch.processArray(uids, (uids) => __awaiter(this, void 0, void 0, function* () {
                yield pushToUids(uids, notification);
            }), { interval: 1000, batch: 500 }, (err) => {
                if (err) {
                    winston_1.default.error(err.stack);
                }
            });
        }, 1000);
    });
};
function pushToUids(uids, notification) {
    return __awaiter(this, void 0, void 0, function* () {
        function sendNotification(uids) {
            return __awaiter(this, void 0, void 0, function* () {
                if (!uids.length) {
                    return;
                }
                const cutoff = Date.now() - notificationPruneCutoff;
                const unreadKeys = uids.map(uid => `uid:${uid}:notifications:unread`);
                const readKeys = uids.map(uid => `uid:${uid}:notifications:read`);
                yield Promise.all([
                    db.sortedSetsAdd(unreadKeys, notification.datetime, notification.nid),
                    db.sortedSetsRemove(readKeys, notification.nid),
                ]);
                yield db.sortedSetsRemoveRangeByScore(unreadKeys.concat(readKeys), '-inf', cutoff);
                const websockets = require('./socket.io');
                if (websockets.server) {
                    uids.forEach((uid) => {
                        websockets.in(`uid_${uid}`).emit('event:new_notification', notification);
                    });
                }
            });
        }
        function sendEmail(uids) {
            return __awaiter(this, void 0, void 0, function* () {
                // Update CTA messaging (as not all notification types need custom text)
                if (['new-reply', 'new-chat'].includes(notification.type)) {
                    notification['cta-type'] = notification.type;
                }
                let body = notification.bodyLong || '';
                if (meta.config.removeEmailNotificationImages) {
                    body = body.replace(/<img[^>]*>/, '');
                }
                body = posts.relativeToAbsolute(body, posts.urlRegex);
                body = posts.relativeToAbsolute(body, posts.imgRegex);
                let errorLogged = false;
                yield async.eachLimit(uids, 3, (uid) => __awaiter(this, void 0, void 0, function* () {
                    yield emailer.send('notification', uid, {
                        path: notification.path,
                        notification_url: notification.path.startsWith('http') ? notification.path : nconf_1.default.get('url') + notification.path,
                        subject: utils.stripHTMLTags(notification.subject || '[[notifications:new_notification]]'),
                        intro: utils.stripHTMLTags(notification.bodyShort),
                        body: body,
                        notification: notification,
                        showUnsubscribe: true,
                    }).catch((err) => {
                        if (!errorLogged) {
                            winston_1.default.error(`[emailer.send] ${err.stack}`);
                            errorLogged = true;
                        }
                    });
                }));
            });
        }
        function getUidsBySettings(uids) {
            return __awaiter(this, void 0, void 0, function* () {
                const uidsToNotify = [];
                const uidsToEmail = [];
                const usersSettings = yield User.getMultipleUserSettings(uids);
                usersSettings.forEach((userSettings) => {
                    const setting = userSettings[`notificationType_${notification.type}`] || 'notification';
                    if (setting === 'notification' || setting === 'notificationemail') {
                        uidsToNotify.push(userSettings.uid);
                    }
                    if (setting === 'email' || setting === 'notificationemail') {
                        uidsToEmail.push(userSettings.uid);
                    }
                });
                return { uidsToNotify: uidsToNotify, uidsToEmail: uidsToEmail };
            });
        }
        // Remove uid from recipients list if they have blocked the user triggering the notification
        uids = yield User.blocks.filterUids(notification.from, uids);
        const data = yield plugins.hooks.fire('filter:notification.push', { notification: notification, uids: uids });
        if (!data || !data.notification || !data.uids || !data.uids.length) {
            return;
        }
        notification = data.notification;
        let results = { uidsToNotify: data.uids, uidsToEmail: [] };
        if (notification.type) {
            results = yield getUidsBySettings(data.uids);
        }
        yield Promise.all([
            sendNotification(results.uidsToNotify),
            sendEmail(results.uidsToEmail),
        ]);
        plugins.hooks.fire('action:notification.pushed', {
            notification: notification,
            uids: results.uidsToNotify,
            uidsNotified: results.uidsToNotify,
            uidsEmailed: results.uidsToEmail,
        });
    });
}
Notifications.pushGroup = function (notification, groupName) {
    return __awaiter(this, void 0, void 0, function* () {
        if (!notification) {
            return;
        }
        const members = yield groups.getMembers(groupName, 0, -1);
        yield Notifications.push(notification, members);
    });
};
Notifications.pushGroups = function (notification, groupNames) {
    return __awaiter(this, void 0, void 0, function* () {
        if (!notification) {
            return;
        }
        let groupMembers = yield groups.getMembersOfGroups(groupNames);
        groupMembers = _.uniq(_.flatten(groupMembers));
        yield Notifications.push(notification, groupMembers);
    });
};
Notifications.rescind = function (nids) {
    return __awaiter(this, void 0, void 0, function* () {
        nids = Array.isArray(nids) ? nids : [nids];
        yield Promise.all([
            db.sortedSetRemove('notifications', nids),
            db.deleteAll(nids.map(nid => `notifications:${nid}`)),
        ]);
    });
};
Notifications.markRead = function (nid, uid) {
    return __awaiter(this, void 0, void 0, function* () {
        if (parseInt(uid, 10) <= 0 || !nid) {
            return;
        }
        yield Notifications.markReadMultiple([nid], uid);
    });
};
Notifications.markUnread = function (nid, uid) {
    return __awaiter(this, void 0, void 0, function* () {
        if (!(parseInt(uid, 10) > 0) || !nid) {
            return;
        }
        const notification = yield db.getObject(`notifications:${nid}`);
        if (!notification) {
            throw new Error('[[error:no-notification]]');
        }
        notification.datetime = notification.datetime || Date.now();
        yield Promise.all([
            db.sortedSetRemove(`uid:${uid}:notifications:read`, nid),
            db.sortedSetAdd(`uid:${uid}:notifications:unread`, notification.datetime, nid),
        ]);
    });
};
Notifications.markReadMultiple = function (nids, uid) {
    return __awaiter(this, void 0, void 0, function* () {
        nids = nids.filter(Boolean);
        if (!Array.isArray(nids) || !nids.length || !(parseInt(uid, 10) > 0)) {
            return;
        }
        let notificationKeys = nids.map(nid => `notifications:${nid}`);
        let mergeIds = yield db.getObjectsFields(notificationKeys, ['mergeId']);
        // Isolate mergeIds and find related notifications
        mergeIds = _.uniq(mergeIds.map(set => set.mergeId));
        const relatedNids = yield Notifications.findRelated(mergeIds, `uid:${uid}:notifications:unread`);
        notificationKeys = _.union(nids, relatedNids).map(nid => `notifications:${nid}`);
        let notificationData = yield db.getObjectsFields(notificationKeys, ['nid', 'datetime']);
        notificationData = notificationData.filter(n => n && n.nid);
        nids = notificationData.map(n => n.nid);
        const datetimes = notificationData.map(n => (n && n.datetime) || Date.now());
        yield Promise.all([
            db.sortedSetRemove(`uid:${uid}:notifications:unread`, nids),
            db.sortedSetAdd(`uid:${uid}:notifications:read`, datetimes, nids),
        ]);
    });
};
Notifications.markAllRead = function (uid) {
    return __awaiter(this, void 0, void 0, function* () {
        const nids = yield db.getSortedSetRevRange(`uid:${uid}:notifications:unread`, 0, 99);
        yield Notifications.markReadMultiple(nids, uid);
    });
};
Notifications.prune = function () {
    return __awaiter(this, void 0, void 0, function* () {
        const cutoffTime = Date.now() - notificationPruneCutoff;
        const nids = yield db.getSortedSetRangeByScore('notifications', 0, 500, '-inf', cutoffTime);
        if (!nids.length) {
            return;
        }
        try {
            yield Promise.all([
                db.sortedSetRemove('notifications', nids),
                db.deleteAll(nids.map(nid => `notifications:${nid}`)),
            ]);
            yield batch.processSortedSet('users:joindate', (uids) => __awaiter(this, void 0, void 0, function* () {
                const unread = uids.map(uid => `uid:${uid}:notifications:unread`);
                const read = uids.map(uid => `uid:${uid}:notifications:read`);
                yield db.sortedSetsRemoveRangeByScore(unread.concat(read), '-inf', cutoffTime);
            }), { batch: 500, interval: 100 });
        }
        catch (err) {
            if (err) {
                winston_1.default.error(`Encountered error pruning notifications\n${err.stack}`);
            }
        }
    });
};
Notifications.merge = function (notifications) {
    return __awaiter(this, void 0, void 0, function* () {
        // When passed a set of notification objects, merge any that can be merged
        const mergeIds = [
            'notifications:upvoted_your_post_in',
            'notifications:user_started_following_you',
            'notifications:user_posted_to',
            'notifications:user_flagged_post_in',
            'notifications:user_flagged_user',
            'new_register',
            'post-queue',
        ];
        notifications = mergeIds.reduce((notifications, mergeId) => {
            const isolated = notifications.filter(n => n && n.hasOwnProperty('mergeId') && n.mergeId.split('|')[0] === mergeId);
            if (isolated.length <= 1) {
                return notifications; // Nothing to merge
            }
            // Each isolated mergeId may have multiple differentiators, so process each separately
            const differentiators = isolated.reduce((cur, next) => {
                const differentiator = next.mergeId.split('|')[1] || 0;
                if (!cur.includes(differentiator)) {
                    cur.push(differentiator);
                }
                return cur;
            }, []);
            differentiators.forEach((differentiator) => {
                let set;
                if (differentiator === 0 && differentiators.length === 1) {
                    set = isolated;
                }
                else {
                    set = isolated.filter(n => n.mergeId === (`${mergeId}|${differentiator}`));
                }
                const modifyIndex = notifications.indexOf(set[0]);
                if (modifyIndex === -1 || set.length === 1) {
                    return notifications;
                }
                switch (mergeId) {
                    case 'notifications:upvoted_your_post_in':
                    case 'notifications:user_started_following_you':
                    case 'notifications:user_posted_to':
                    case 'notifications:user_flagged_post_in':
                    case 'notifications:user_flagged_user':
                        {
                            const usernames = _.uniq(set.map(notifObj => notifObj && notifObj.user && notifObj.user.username));
                            const numUsers = usernames.length;
                            const title = utils.decodeHTMLEntities(notifications[modifyIndex].topicTitle || '');
                            let titleEscaped = title.replace(/%/g, '&#37;').replace(/,/g, '&#44;');
                            titleEscaped = titleEscaped ? (`, ${titleEscaped}`) : '';
                            if (numUsers === 2) {
                                notifications[modifyIndex].bodyShort = `[[${mergeId}_dual, ${usernames.join(', ')}${titleEscaped}]]`;
                            }
                            else if (numUsers > 2) {
                                notifications[modifyIndex].bodyShort = `[[${mergeId}_multiple, ${usernames[0]}, ${numUsers - 1}${titleEscaped}]]`;
                            }
                            notifications[modifyIndex].path = set[set.length - 1].path;
                        }
                        break;
                    case 'new_register':
                        notifications[modifyIndex].bodyShort = `[[notifications:${mergeId}_multiple, ${set.length}]]`;
                        break;
                }
                // Filter out duplicates
                notifications = notifications.filter((notifObj, idx) => {
                    if (!notifObj || !notifObj.mergeId) {
                        return true;
                    }
                    return !(notifObj.mergeId === (mergeId + (differentiator ? `|${differentiator}` : '')) && idx !== modifyIndex);
                });
            });
            return notifications;
        }, notifications);
        const data = yield plugins.hooks.fire('filter:notifications.merge', {
            notifications: notifications,
        });
        return data && data.notifications;
    });
};
require('./promisify').promisify(Notifications);
exports.default = Notifications;
