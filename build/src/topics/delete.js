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
const database = __importStar(require("../database"));
const db = database;
const user_1 = __importDefault(require("../user"));
const posts = require('../posts');
const categories = require('../categories');
const plugins = require('../plugins');
const batch = require('../batch');
function default_1(Topics) {
    Topics.delete = function (tid, uid) {
        return __awaiter(this, void 0, void 0, function* () {
            yield removeTopicPidsFromCid(tid);
            yield Topics.setTopicFields(tid, {
                deleted: 1,
                deleterUid: uid,
                deletedTimestamp: Date.now(),
            });
        });
    };
    function removeTopicPidsFromCid(tid) {
        return __awaiter(this, void 0, void 0, function* () {
            const [cid, pids] = yield Promise.all([
                Topics.getTopicField(tid, 'cid'),
                Topics.getPids(tid),
            ]);
            yield db.sortedSetRemove(`cid:${cid}:pids`, pids);
            yield categories.updateRecentTidForCid(cid);
        });
    }
    function addTopicPidsToCid(tid) {
        return __awaiter(this, void 0, void 0, function* () {
            const [cid, pids] = yield Promise.all([
                Topics.getTopicField(tid, 'cid'),
                Topics.getPids(tid),
            ]);
            let postData = yield posts.getPostsFields(pids, ['pid', 'timestamp', 'deleted']);
            postData = postData.filter(post => post && !post.deleted);
            const pidsToAdd = postData.map(post => post.pid);
            const scores = postData.map(post => post.timestamp);
            yield db.sortedSetAdd(`cid:${cid}:pids`, scores, pidsToAdd);
            yield categories.updateRecentTidForCid(cid);
        });
    }
    Topics.restore = function (tid) {
        return __awaiter(this, void 0, void 0, function* () {
            yield Promise.all([
                Topics.deleteTopicFields(tid, [
                    'deleterUid', 'deletedTimestamp',
                ]),
                addTopicPidsToCid(tid),
            ]);
            yield Topics.setTopicField(tid, 'deleted', 0);
        });
    };
    Topics.purgePostsAndTopic = function (tid, uid) {
        return __awaiter(this, void 0, void 0, function* () {
            const mainPid = yield Topics.getTopicField(tid, 'mainPid');
            yield batch.processSortedSet(`tid:${tid}:posts`, (pids) => __awaiter(this, void 0, void 0, function* () {
                yield posts.purge(pids, uid);
            }), { alwaysStartAt: 0, batch: 500 });
            yield posts.purge(mainPid, uid);
            yield Topics.purge(tid, uid);
        });
    };
    Topics.purge = function (tid, uid) {
        return __awaiter(this, void 0, void 0, function* () {
            const [deletedTopic, tags] = yield Promise.all([
                Topics.getTopicData(tid),
                Topics.getTopicTags(tid),
            ]);
            if (!deletedTopic) {
                return;
            }
            deletedTopic.tags = tags;
            yield deleteFromFollowersIgnorers(tid);
            yield Promise.all([
                db.deleteAll([
                    `tid:${tid}:followers`,
                    `tid:${tid}:ignorers`,
                    `tid:${tid}:posts`,
                    `tid:${tid}:posts:votes`,
                    `tid:${tid}:bookmarks`,
                    `tid:${tid}:posters`,
                ]),
                db.sortedSetsRemove([
                    'topics:tid',
                    'topics:recent',
                    'topics:posts',
                    'topics:views',
                    'topics:votes',
                    'topics:scheduled',
                ], tid),
                deleteTopicFromCategoryAndUser(tid),
                Topics.deleteTopicTags(tid),
                Topics.events.purge(tid),
                Topics.thumbs.deleteAll(tid),
                reduceCounters(tid),
            ]);
            plugins.hooks.fire('action:topic.purge', { topic: deletedTopic, uid: uid });
            yield db.delete(`topic:${tid}`);
        });
    };
    function deleteFromFollowersIgnorers(tid) {
        return __awaiter(this, void 0, void 0, function* () {
            const [followers, ignorers] = yield Promise.all([
                db.getSetMembers(`tid:${tid}:followers`),
                db.getSetMembers(`tid:${tid}:ignorers`),
            ]);
            const followerKeys = followers.map(uid => `uid:${uid}:followed_tids`);
            const ignorerKeys = ignorers.map(uid => `uid:${uid}ignored_tids`);
            yield db.sortedSetsRemove(followerKeys.concat(ignorerKeys), tid);
        });
    }
    function deleteTopicFromCategoryAndUser(tid) {
        return __awaiter(this, void 0, void 0, function* () {
            const topicData = yield Topics.getTopicFields(tid, ['cid', 'uid']);
            yield Promise.all([
                db.sortedSetsRemove([
                    `cid:${topicData.cid}:tids`,
                    `cid:${topicData.cid}:tids:pinned`,
                    `cid:${topicData.cid}:tids:posts`,
                    `cid:${topicData.cid}:tids:lastposttime`,
                    `cid:${topicData.cid}:tids:votes`,
                    `cid:${topicData.cid}:tids:views`,
                    `cid:${topicData.cid}:recent_tids`,
                    `cid:${topicData.cid}:uid:${topicData.uid}:tids`,
                    `uid:${topicData.uid}:topics`,
                ], tid),
                user_1.default.decrementUserFieldBy(topicData.uid, 'topiccount', 1),
            ]);
            yield categories.updateRecentTidForCid(topicData.cid);
        });
    }
    function reduceCounters(tid) {
        return __awaiter(this, void 0, void 0, function* () {
            const incr = -1;
            yield db.incrObjectFieldBy('global', 'topicCount', incr);
            const topicData = yield Topics.getTopicFields(tid, ['cid', 'postcount']);
            const postCountChange = incr * topicData.postcount;
            yield Promise.all([
                db.incrObjectFieldBy('global', 'postCount', postCountChange),
                db.incrObjectFieldBy(`category:${topicData.cid}`, 'post_count', postCountChange),
                db.incrObjectFieldBy(`category:${topicData.cid}`, 'topic_count', incr),
            ]);
        });
    }
}
exports.default = default_1;
;
