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
const _ = require('lodash');
const winston_1 = __importDefault(require("winston"));
const { CronJob } = require('cron');
const database = __importStar(require("../database"));
const db = database;
const posts = require('../posts');
const socketHelpers = require('../socket.io/helpers');
const topics = require('./index');
const user_1 = __importDefault(require("../user"));
const Scheduled = {};
Scheduled.startJobs = function () {
    winston_1.default.verbose('[scheduled topics] Starting jobs.');
    new CronJob('*/1 * * * *', Scheduled.handleExpired, null, true);
};
Scheduled.handleExpired = function () {
    return __awaiter(this, void 0, void 0, function* () {
        const now = Date.now();
        const tids = yield db.getSortedSetRangeByScore('topics:scheduled', 0, -1, '-inf', now);
        if (!tids.length) {
            return;
        }
        let topicsData = yield topics.getTopicsData(tids);
        // Filter deleted
        topicsData = topicsData.filter((topicData) => Boolean(topicData));
        const uids = _.uniq(topicsData.map((topicData) => topicData.uid)).filter((uid) => uid); // Filter guests topics
        // Restore first to be not filtered for being deleted
        // Restoring handles "updateRecentTid"
        yield Promise.all([].concat(topicsData.map((topicData) => topics.restore(topicData.tid)), topicsData.map((topicData) => topics.updateLastPostTimeFromLastPid(topicData.tid))));
        yield Promise.all([].concat(
        // @ts-ignore
        sendNotifications(uids, topicsData), updateUserLastposttimes(uids, topicsData), ...topicsData.map((topicData) => unpin(topicData.tid, topicData)), db.sortedSetsRemoveRangeByScore([`topics:scheduled`], '-inf', now)));
    });
};
// topics/tools.js#pin/unpin would block non-admins/mods, thus the local versions
Scheduled.pin = function (tid, topicData) {
    return __awaiter(this, void 0, void 0, function* () {
        return Promise.all([
            topics.setTopicField(tid, 'pinned', 1),
            db.sortedSetAdd(`cid:${topicData.cid}:tids:pinned`, Date.now(), tid),
            db.sortedSetsRemove([
                `cid:${topicData.cid}:tids`,
                `cid:${topicData.cid}:tids:posts`,
                `cid:${topicData.cid}:tids:votes`,
                `cid:${topicData.cid}:tids:views`,
            ], tid),
        ]);
    });
};
Scheduled.reschedule = function ({ cid, tid, timestamp, uid }) {
    return __awaiter(this, void 0, void 0, function* () {
        yield Promise.all([
            db.sortedSetsAdd([
                'topics:scheduled',
                `uid:${uid}:topics`,
                'topics:tid',
                `cid:${cid}:uid:${uid}:tids`,
            ], timestamp, tid),
            shiftPostTimes(tid, timestamp),
        ]);
        return topics.updateLastPostTimeFromLastPid(tid);
    });
};
function unpin(tid, topicData) {
    return [
        topics.setTopicField(tid, 'pinned', 0),
        topics.deleteTopicField(tid, 'pinExpiry'),
        db.sortedSetRemove(`cid:${topicData.cid}:tids:pinned`, tid),
        db.sortedSetAddBulk([
            [`cid:${topicData.cid}:tids`, topicData.lastposttime, tid],
            [`cid:${topicData.cid}:tids:posts`, topicData.postcount, tid],
            [`cid:${topicData.cid}:tids:votes`, parseInt(topicData.votes, 10) || 0, tid],
            [`cid:${topicData.cid}:tids:views`, topicData.viewcount, tid],
        ]),
    ];
}
function sendNotifications(uids, topicsData) {
    return __awaiter(this, void 0, void 0, function* () {
        const usernames = yield Promise.all(uids.map(uid => user_1.default.getUserField(uid, 'username')));
        const uidToUsername = Object.fromEntries(uids.map((uid, idx) => [uid, usernames[idx]]));
        const postsData = yield posts.getPostsData(topicsData.map(({ mainPid }) => mainPid));
        postsData.forEach((postData, idx) => {
            postData.user = {};
            postData.user.username = uidToUsername[postData.uid];
            postData.topic = topicsData[idx];
        });
        return Promise.all(topicsData.map((t, idx) => user_1.default.notifications.sendTopicNotificationToFollowers(t.uid, t, postsData[idx])).concat(topicsData.map((t, idx) => socketHelpers.notifyNew(t.uid, 'newTopic', { posts: [postsData[idx]], topic: t }))));
    });
}
function updateUserLastposttimes(uids, topicsData) {
    return __awaiter(this, void 0, void 0, function* () {
        const lastposttimes = (yield user_1.default.getUsersFields(uids, ['lastposttime'])).map((u) => u.lastposttime);
        let tstampByUid = {};
        topicsData.forEach((tD) => {
            tstampByUid[tD.uid] = tstampByUid[tD.uid] ? tstampByUid[tD.uid].concat(tD.lastposttime) : [tD.lastposttime];
        });
        tstampByUid = Object.fromEntries(Object.entries(tstampByUid).map(uidTimestamp => [uidTimestamp[0], Math.max(...uidTimestamp[1])]));
        const uidsToUpdate = uids.filter((uid, idx) => tstampByUid[uid] > lastposttimes[idx]);
        return Promise.all(uidsToUpdate.map(uid => user_1.default.setUserField(uid, 'lastposttime', tstampByUid[uid])));
    });
}
function shiftPostTimes(tid, timestamp) {
    return __awaiter(this, void 0, void 0, function* () {
        const pids = (yield posts.getPidsFromSet(`tid:${tid}:posts`, 0, -1, false));
        // Leaving other related score values intact, since they reflect post order correctly, and it seems that's good enough
        return db.setObjectBulk(pids.map((pid, idx) => [`post:${pid}`, { timestamp: timestamp + idx + 1 }]));
    });
}
