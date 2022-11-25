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
const winston_1 = __importDefault(require("winston"));
const _ = require('lodash');
const database = __importStar(require("../database"));
const db = database;
const meta_1 = __importDefault(require("../meta"));
const notifications = require('../notifications');
const privileges = require('../privileges');
const plugins = require('../plugins');
const utils = require('../utils');
const UserNotifications = {};
UserNotifications.get = function (uid) {
    return __awaiter(this, void 0, void 0, function* () {
        if (parseInt(uid, 10) <= 0) {
            return { read: [], unread: [] };
        }
        let unread = yield getNotificationsFromSet(`uid:${uid}:notifications:unread`, uid, 0, 49);
        unread = unread.filter(Boolean);
        let read = [];
        if (unread.length < 50) {
            read = yield getNotificationsFromSet(`uid:${uid}:notifications:read`, uid, 0, 49 - unread.length);
        }
        return yield plugins.hooks.fire('filter:user.notifications.get', {
            uid,
            read: read.filter(Boolean),
            unread: unread,
        });
    });
};
function filterNotifications(nids, filter) {
    return __awaiter(this, void 0, void 0, function* () {
        if (!filter) {
            return nids;
        }
        const keys = nids.map(nid => `notifications:${nid}`);
        const notifications = yield db.getObjectsFields(keys, ['nid', 'type']);
        return notifications.filter(n => n && n.nid && n.type === filter).map(n => n.nid);
    });
}
UserNotifications.getAll = function (uid, filter) {
    return __awaiter(this, void 0, void 0, function* () {
        let nids = yield db.getSortedSetRevRange([
            `uid:${uid}:notifications:unread`,
            `uid:${uid}:notifications:read`,
        ], 0, -1);
        nids = _.uniq(nids);
        const exists = yield db.isSortedSetMembers('notifications', nids);
        const deleteNids = [];
        nids = nids.filter((nid, index) => {
            if (!nid || !exists[index]) {
                deleteNids.push(nid);
            }
            return nid && exists[index];
        });
        yield deleteUserNids(deleteNids, uid);
        return yield filterNotifications(nids, filter);
    });
};
function deleteUserNids(nids, uid) {
    return __awaiter(this, void 0, void 0, function* () {
        yield db.sortedSetRemove([
            `uid:${uid}:notifications:read`,
            `uid:${uid}:notifications:unread`,
        ], nids);
    });
}
function getNotificationsFromSet(set, uid, start, stop) {
    return __awaiter(this, void 0, void 0, function* () {
        const nids = yield db.getSortedSetRevRange(set, start, stop);
        return yield UserNotifications.getNotifications(nids, uid);
    });
}
UserNotifications.getNotifications = function (nids, uid) {
    return __awaiter(this, void 0, void 0, function* () {
        if (!Array.isArray(nids) || !nids.length) {
            return [];
        }
        const [notifObjs, hasRead] = yield Promise.all([
            notifications.getMultiple(nids),
            db.isSortedSetMembers(`uid:${uid}:notifications:read`, nids),
        ]);
        const deletedNids = [];
        let notificationData = notifObjs.filter((notification, index) => {
            if (!notification || !notification.nid) {
                deletedNids.push(nids[index]);
            }
            if (notification) {
                notification.read = hasRead[index];
                notification.readClass = !notification.read ? 'unread' : '';
            }
            return notification;
        });
        yield deleteUserNids(deletedNids, uid);
        notificationData = yield notifications.merge(notificationData);
        const result = yield plugins.hooks.fire('filter:user.notifications.getNotifications', {
            uid: uid,
            notifications: notificationData,
        });
        return result && result.notifications;
    });
};
UserNotifications.getUnreadInterval = function (uid, interval) {
    return __awaiter(this, void 0, void 0, function* () {
        const dayInMs = 1000 * 60 * 60 * 24;
        const times = {
            day: dayInMs,
            week: 7 * dayInMs,
            month: 30 * dayInMs,
        };
        if (!times[interval]) {
            return [];
        }
        const min = Date.now() - times[interval];
        const nids = yield db.getSortedSetRevRangeByScore(`uid:${uid}:notifications:unread`, 0, 20, '+inf', min);
        return yield UserNotifications.getNotifications(nids, uid);
    });
};
UserNotifications.getDailyUnread = function (uid) {
    return __awaiter(this, void 0, void 0, function* () {
        return yield UserNotifications.getUnreadInterval(uid, 'day');
    });
};
UserNotifications.getUnreadCount = function (uid) {
    return __awaiter(this, void 0, void 0, function* () {
        if (parseInt(uid, 10) <= 0) {
            return 0;
        }
        let nids = yield db.getSortedSetRevRange(`uid:${uid}:notifications:unread`, 0, 99);
        nids = yield notifications.filterExists(nids);
        const keys = nids.map(nid => `notifications:${nid}`);
        const notifData = yield db.getObjectsFields(keys, ['mergeId']);
        const mergeIds = notifData.map(n => n.mergeId);
        // Collapse any notifications with identical mergeIds
        let count = mergeIds.reduce((count, mergeId, idx, arr) => {
            // A missing (null) mergeId means that notification is counted separately.
            if (mergeId === null || idx === arr.indexOf(mergeId)) {
                count += 1;
            }
            return count;
        }, 0);
        ({ count } = yield plugins.hooks.fire('filter:user.notifications.getCount', { uid, count }));
        return count;
    });
};
UserNotifications.getUnreadByField = function (uid, field, values) {
    return __awaiter(this, void 0, void 0, function* () {
        const nids = yield db.getSortedSetRevRange(`uid:${uid}:notifications:unread`, 0, 99);
        if (!nids.length) {
            return [];
        }
        const keys = nids.map(nid => `notifications:${nid}`);
        const notifData = yield db.getObjectsFields(keys, ['nid', field]);
        const valuesSet = new Set(values.map(value => String(value)));
        return notifData.filter(n => n && n[field] && valuesSet.has(String(n[field]))).map(n => n.nid);
    });
};
UserNotifications.deleteAll = function (uid) {
    return __awaiter(this, void 0, void 0, function* () {
        if (parseInt(uid, 10) <= 0) {
            return;
        }
        yield db.deleteAll([
            `uid:${uid}:notifications:unread`,
            `uid:${uid}:notifications:read`,
        ]);
    });
};
UserNotifications.sendTopicNotificationToFollowers = function (uid, topicData, postData) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            let followers = yield db.getSortedSetRange(`followers:${uid}`, 0, -1);
            followers = yield privileges.categories.filterUids('read', topicData.cid, followers);
            if (!followers.length) {
                return;
            }
            let { title } = topicData;
            if (title) {
                title = utils.decodeHTMLEntities(title);
                title = title.replace(/,/g, '\\,');
            }
            const notifObj = yield notifications.create({
                type: 'new-topic',
                bodyShort: `[[notifications:user_posted_topic, ${postData.user.displayname}, ${title}]]`,
                bodyLong: postData.content,
                pid: postData.pid,
                path: `/post/${postData.pid}`,
                nid: `tid:${postData.tid}:uid:${uid}`,
                tid: postData.tid,
                from: uid,
            });
            yield notifications.push(notifObj, followers);
        }
        catch (err) {
            winston_1.default.error(err.stack);
        }
    });
};
UserNotifications.sendWelcomeNotification = function (uid) {
    return __awaiter(this, void 0, void 0, function* () {
        if (!meta_1.default.config.welcomeNotification) {
            return;
        }
        const path = meta_1.default.config.welcomeLink ? meta_1.default.config.welcomeLink : '#';
        const notifObj = yield notifications.create({
            bodyShort: meta_1.default.config.welcomeNotification,
            path: path,
            nid: `welcome_${uid}`,
            from: meta_1.default.config.welcomeUid ? meta_1.default.config.welcomeUid : null,
        });
        yield notifications.push(notifObj, [uid]);
    });
};
UserNotifications.sendNameChangeNotification = function (uid, username) {
    return __awaiter(this, void 0, void 0, function* () {
        const notifObj = yield notifications.create({
            bodyShort: `[[user:username_taken_workaround, ${username}]]`,
            image: 'brand:logo',
            nid: `username_taken:${uid}`,
            datetime: Date.now(),
        });
        yield notifications.push(notifObj, uid);
    });
};
UserNotifications.pushCount = function (uid) {
    return __awaiter(this, void 0, void 0, function* () {
        const websockets = require('../socket.io');
        const count = yield UserNotifications.getUnreadCount(uid);
        websockets.in(`uid_${uid}`).emit('event:notifications.updateCount', count);
    });
};
