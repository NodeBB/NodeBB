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
const database_1 = __importDefault(require("../../database"));
exports.default = {
    name: 'Dismiss flags from deleted topics',
    timestamp: Date.UTC(2016, 3, 29),
    method: function () {
        return __awaiter(this, void 0, void 0, function* () {
            const posts = require('../../posts');
            const topics = require('../../topics');
            const pids = yield database_1.default.getSortedSetRange('posts:flagged', 0, -1);
            const postData = yield posts.getPostsFields(pids, ['tid']);
            const tids = postData.map((t) => t.tid);
            const topicData = yield topics.getTopicsFields(tids, ['deleted']);
            const toDismiss = topicData.map((t, idx) => (parseInt(t.deleted, 10) === 1 ? pids[idx] : null)).filter(Boolean);
            winston_1.default.verbose(`[2016/04/29] ${toDismiss.length} dismissable flags found`);
            yield Promise.all(toDismiss.map(dismissFlag));
        });
    },
};
// copied from core since this function was removed
// https://github.com/NodeBB/NodeBB/blob/v1.x.x/src/posts/flags.js
function dismissFlag(pid) {
    return __awaiter(this, void 0, void 0, function* () {
        const postData = yield database_1.default.getObjectFields(`post:${pid}`, ['pid', 'uid', 'flags']);
        if (!postData.pid) {
            return;
        }
        if (parseInt(postData.uid, 10) && parseInt(postData.flags, 10) > 0) {
            yield Promise.all([
                database_1.default.sortedSetIncrBy('users:flags', -postData.flags, postData.uid),
                database_1.default.incrObjectFieldBy(`user:${postData.uid}`, 'flags', -postData.flags),
            ]);
        }
        const uids = yield database_1.default.getSortedSetRange(`pid:${pid}:flag:uids`, 0, -1);
        const nids = uids.map(uid => `post_flag:${pid}:uid:${uid}`);
        yield Promise.all([
            database_1.default.deleteAll(nids.map(nid => `notifications:${nid}`)),
            database_1.default.sortedSetRemove('notifications', nids),
            database_1.default.delete(`pid:${pid}:flag:uids`),
            database_1.default.sortedSetsRemove([
                'posts:flagged',
                'posts:flags:count',
                `uid:${postData.uid}:flag:pids`,
            ], pid),
            database_1.default.deleteObjectField(`post:${pid}`, 'flags'),
            database_1.default.delete(`pid:${pid}:flag:uid:reason`),
            database_1.default.deleteObjectFields(`post:${pid}`, ['flag:state', 'flag:assignee', 'flag:notes', 'flag:history']),
        ]);
        yield database_1.default.sortedSetsRemoveRangeByScore(['users:flags'], '-inf', 0);
    });
}
