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
const _ = require('lodash');
const database_1 = __importDefault(require("../database"));
const topics = require('.');
const categories = require('../categories');
const user_1 = __importDefault(require("../user"));
const plugins = require('../plugins');
const privileges = require('../privileges');
const utils = require('../utils');
function default_1(Topics) {
    const topicTools = {};
    Topics.tools = topicTools;
    topicTools.delete = function (tid, uid) {
        return __awaiter(this, void 0, void 0, function* () {
            return yield toggleDelete(tid, uid, true);
        });
    };
    topicTools.restore = function (tid, uid) {
        return __awaiter(this, void 0, void 0, function* () {
            return yield toggleDelete(tid, uid, false);
        });
    };
    function toggleDelete(tid, uid, isDelete) {
        return __awaiter(this, void 0, void 0, function* () {
            const topicData = yield Topics.getTopicData(tid);
            if (!topicData) {
                throw new Error('[[error:no-topic]]');
            }
            // Scheduled topics can only be purged
            if (topicData.scheduled) {
                throw new Error('[[error:invalid-data]]');
            }
            const canDelete = yield privileges.topics.canDelete(tid, uid);
            const hook = isDelete ? 'delete' : 'restore';
            const data = yield plugins.hooks.fire(`filter:topic.${hook}`, { topicData: topicData, uid: uid, isDelete: isDelete, canDelete: canDelete, canRestore: canDelete });
            if ((!data.canDelete && data.isDelete) || (!data.canRestore && !data.isDelete)) {
                throw new Error('[[error:no-privileges]]');
            }
            if (data.topicData.deleted && data.isDelete) {
                throw new Error('[[error:topic-already-deleted]]');
            }
            else if (!data.topicData.deleted && !data.isDelete) {
                throw new Error('[[error:topic-already-restored]]');
            }
            if (data.isDelete) {
                yield Topics.delete(data.topicData.tid, data.uid);
            }
            else {
                yield Topics.restore(data.topicData.tid);
            }
            const events = yield Topics.events.log(tid, { type: isDelete ? 'delete' : 'restore', uid });
            data.topicData.deleted = data.isDelete ? 1 : 0;
            if (data.isDelete) {
                plugins.hooks.fire('action:topic.delete', { topic: data.topicData, uid: data.uid });
            }
            else {
                plugins.hooks.fire('action:topic.restore', { topic: data.topicData, uid: data.uid });
            }
            const userData = yield user_1.default.getUserFields(data.uid, ['username', 'userslug']);
            return {
                tid: data.topicData.tid,
                cid: data.topicData.cid,
                isDelete: data.isDelete,
                uid: data.uid,
                user: userData,
                events,
            };
        });
    }
    topicTools.purge = function (tid, uid) {
        return __awaiter(this, void 0, void 0, function* () {
            const topicData = yield Topics.getTopicData(tid);
            if (!topicData) {
                throw new Error('[[error:no-topic]]');
            }
            const canPurge = yield privileges.topics.canPurge(tid, uid);
            if (!canPurge) {
                throw new Error('[[error:no-privileges]]');
            }
            yield Topics.purgePostsAndTopic(tid, uid);
            return { tid: tid, cid: topicData.cid, uid: uid };
        });
    };
    topicTools.lock = function (tid, uid) {
        return __awaiter(this, void 0, void 0, function* () {
            return yield toggleLock(tid, uid, true);
        });
    };
    topicTools.unlock = function (tid, uid) {
        return __awaiter(this, void 0, void 0, function* () {
            return yield toggleLock(tid, uid, false);
        });
    };
    function toggleLock(tid, uid, lock) {
        return __awaiter(this, void 0, void 0, function* () {
            const topicData = yield Topics.getTopicFields(tid, ['tid', 'uid', 'cid']);
            if (!topicData || !topicData.cid) {
                throw new Error('[[error:no-topic]]');
            }
            const isAdminOrMod = yield privileges.categories.isAdminOrMod(topicData.cid, uid);
            if (!isAdminOrMod) {
                throw new Error('[[error:no-privileges]]');
            }
            yield Topics.setTopicField(tid, 'locked', lock ? 1 : 0);
            topicData.events = yield Topics.events.log(tid, { type: lock ? 'lock' : 'unlock', uid });
            topicData.isLocked = lock; // deprecate in v2.0
            topicData.locked = lock;
            plugins.hooks.fire('action:topic.lock', { topic: _.clone(topicData), uid: uid });
            return topicData;
        });
    }
    topicTools.pin = function (tid, uid) {
        return __awaiter(this, void 0, void 0, function* () {
            return yield togglePin(tid, uid, true);
        });
    };
    topicTools.unpin = function (tid, uid) {
        return __awaiter(this, void 0, void 0, function* () {
            return yield togglePin(tid, uid, false);
        });
    };
    topicTools.setPinExpiry = (tid, expiry, uid) => __awaiter(this, void 0, void 0, function* () {
        if (isNaN(parseInt(expiry, 10)) || expiry <= Date.now()) {
            throw new Error('[[error:invalid-data]]');
        }
        const topicData = yield Topics.getTopicFields(tid, ['tid', 'uid', 'cid']);
        const isAdminOrMod = yield privileges.categories.isAdminOrMod(topicData.cid, uid);
        if (!isAdminOrMod) {
            throw new Error('[[error:no-privileges]]');
        }
        yield Topics.setTopicField(tid, 'pinExpiry', expiry);
        plugins.hooks.fire('action:topic.setPinExpiry', { topic: _.clone(topicData), uid: uid });
    });
    topicTools.checkPinExpiry = (tids) => __awaiter(this, void 0, void 0, function* () {
        const expiry = (yield topics.getTopicsFields(tids, ['pinExpiry'])).map((obj) => obj.pinExpiry);
        const now = Date.now();
        tids = yield Promise.all(tids.map((tid, idx) => __awaiter(this, void 0, void 0, function* () {
            if (expiry[idx] && parseInt(expiry[idx], 10) <= now) {
                yield togglePin(tid, 'system', false);
                return null;
            }
            return tid;
        })));
        return tids.filter(Boolean);
    });
    function togglePin(tid, uid, pin) {
        return __awaiter(this, void 0, void 0, function* () {
            const topicData = yield Topics.getTopicData(tid);
            if (!topicData) {
                throw new Error('[[error:no-topic]]');
            }
            if (topicData.scheduled) {
                throw new Error('[[error:cant-pin-scheduled]]');
            }
            if (uid !== 'system' && !(yield privileges.topics.isAdminOrMod(tid, uid))) {
                throw new Error('[[error:no-privileges]]');
            }
            const promises = [
                Topics.setTopicField(tid, 'pinned', pin ? 1 : 0),
                Topics.events.log(tid, { type: pin ? 'pin' : 'unpin', uid }),
            ];
            if (pin) {
                promises.push(database_1.default.sortedSetAdd(`cid:${topicData.cid}:tids:pinned`, Date.now(), tid));
                promises.push(database_1.default.sortedSetsRemove([
                    `cid:${topicData.cid}:tids`,
                    `cid:${topicData.cid}:tids:posts`,
                    `cid:${topicData.cid}:tids:votes`,
                    `cid:${topicData.cid}:tids:views`,
                ], tid));
            }
            else {
                promises.push(database_1.default.sortedSetRemove(`cid:${topicData.cid}:tids:pinned`, tid));
                promises.push(Topics.deleteTopicField(tid, 'pinExpiry'));
                promises.push(database_1.default.sortedSetAddBulk([
                    [`cid:${topicData.cid}:tids`, topicData.lastposttime, tid],
                    [`cid:${topicData.cid}:tids:posts`, topicData.postcount, tid],
                    [`cid:${topicData.cid}:tids:votes`, parseInt(topicData.votes, 10) || 0, tid],
                    [`cid:${topicData.cid}:tids:views`, topicData.viewcount, tid],
                ]));
                topicData.pinExpiry = undefined;
                topicData.pinExpiryISO = undefined;
            }
            const results = yield Promise.all(promises);
            topicData.isPinned = pin; // deprecate in v2.0
            topicData.pinned = pin;
            topicData.events = results[1];
            plugins.hooks.fire('action:topic.pin', { topic: _.clone(topicData), uid });
            return topicData;
        });
    }
    topicTools.orderPinnedTopics = function (uid, data) {
        return __awaiter(this, void 0, void 0, function* () {
            const { tid, order } = data;
            const cid = yield Topics.getTopicField(tid, 'cid');
            if (!cid || !tid || !utils.isNumber(order) || order < 0) {
                throw new Error('[[error:invalid-data]]');
            }
            const isAdminOrMod = yield privileges.categories.isAdminOrMod(cid, uid);
            if (!isAdminOrMod) {
                throw new Error('[[error:no-privileges]]');
            }
            const pinnedTids = yield database_1.default.getSortedSetRange(`cid:${cid}:tids:pinned`, 0, -1);
            const currentIndex = pinnedTids.indexOf(String(tid));
            if (currentIndex === -1) {
                return;
            }
            const newOrder = pinnedTids.length - order - 1;
            // moves tid to index order in the array
            if (pinnedTids.length > 1) {
                pinnedTids.splice(Math.max(0, newOrder), 0, pinnedTids.splice(currentIndex, 1)[0]);
            }
            yield database_1.default.sortedSetAdd(`cid:${cid}:tids:pinned`, pinnedTids.map((tid, index) => index), pinnedTids);
        });
    };
    topicTools.move = function (tid, data) {
        return __awaiter(this, void 0, void 0, function* () {
            const cid = parseInt(data.cid, 10);
            const topicData = yield Topics.getTopicData(tid);
            if (!topicData) {
                throw new Error('[[error:no-topic]]');
            }
            if (cid === topicData.cid) {
                throw new Error('[[error:cant-move-topic-to-same-category]]');
            }
            const tags = yield Topics.getTopicTags(tid);
            yield database_1.default.sortedSetsRemove([
                `cid:${topicData.cid}:tids`,
                `cid:${topicData.cid}:tids:pinned`,
                `cid:${topicData.cid}:tids:posts`,
                `cid:${topicData.cid}:tids:votes`,
                `cid:${topicData.cid}:tids:views`,
                `cid:${topicData.cid}:tids:lastposttime`,
                `cid:${topicData.cid}:recent_tids`,
                `cid:${topicData.cid}:uid:${topicData.uid}:tids`,
                ...tags.map((tag) => `cid:${topicData.cid}:tag:${tag}:topics`),
            ], tid);
            topicData.postcount = topicData.postcount || 0;
            const votes = topicData.upvotes - topicData.downvotes;
            const bulk = [
                [`cid:${cid}:tids:lastposttime`, topicData.lastposttime, tid],
                [`cid:${cid}:uid:${topicData.uid}:tids`, topicData.timestamp, tid],
                ...tags.map((tag) => [`cid:${cid}:tag:${tag}:topics`, topicData.timestamp, tid]),
            ];
            if (topicData.pinned) {
                bulk.push([`cid:${cid}:tids:pinned`, Date.now(), tid]);
            }
            else {
                bulk.push([`cid:${cid}:tids`, topicData.lastposttime, tid]);
                bulk.push([`cid:${cid}:tids:posts`, topicData.postcount, tid]);
                bulk.push([`cid:${cid}:tids:votes`, votes, tid]);
                bulk.push([`cid:${cid}:tids:views`, topicData.viewcount, tid]);
            }
            yield database_1.default.sortedSetAddBulk(bulk);
            const oldCid = topicData.cid;
            yield categories.moveRecentReplies(tid, oldCid, cid);
            yield Promise.all([
                categories.incrementCategoryFieldBy(oldCid, 'topic_count', -1),
                categories.incrementCategoryFieldBy(cid, 'topic_count', 1),
                categories.updateRecentTidForCid(cid),
                categories.updateRecentTidForCid(oldCid),
                Topics.setTopicFields(tid, {
                    cid: cid,
                    oldCid: oldCid,
                }),
                Topics.updateCategoryTagsCount([oldCid, cid], tags),
                Topics.events.log(tid, { type: 'move', uid: data.uid, fromCid: oldCid }),
            ]);
            const hookData = _.clone(data);
            hookData.fromCid = oldCid;
            hookData.toCid = cid;
            hookData.tid = tid;
            plugins.hooks.fire('action:topic.move', hookData);
        });
    };
}
exports.default = default_1;
;
