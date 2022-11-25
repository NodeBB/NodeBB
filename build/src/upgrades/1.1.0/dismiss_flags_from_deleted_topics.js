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
const database = __importStar(require("../../database"));
const db = database;
exports.default = {
    name: 'Dismiss flags from deleted topics',
    timestamp: Date.UTC(2016, 3, 29),
    method: function () {
        return __awaiter(this, void 0, void 0, function* () {
            const posts = require('../../posts');
            const topics = require('../../topics');
            const pids = yield db.getSortedSetRange('posts:flagged', 0, -1);
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
        const postData = yield db.getObjectFields(`post:${pid}`, ['pid', 'uid', 'flags']);
        if (!postData.pid) {
            return;
        }
        if (parseInt(postData.uid, 10) && parseInt(postData.flags, 10) > 0) {
            yield Promise.all([
                db.sortedSetIncrBy('users:flags', -postData.flags, postData.uid),
                db.incrObjectFieldBy(`user:${postData.uid}`, 'flags', -postData.flags),
            ]);
        }
        const uids = yield db.getSortedSetRange(`pid:${pid}:flag:uids`, 0, -1);
        const nids = uids.map(uid => `post_flag:${pid}:uid:${uid}`);
        yield Promise.all([
            db.deleteAll(nids.map(nid => `notifications:${nid}`)),
            db.sortedSetRemove('notifications', nids),
            db.delete(`pid:${pid}:flag:uids`),
            db.sortedSetsRemove([
                'posts:flagged',
                'posts:flags:count',
                `uid:${postData.uid}:flag:pids`,
            ], pid),
            db.deleteObjectField(`post:${pid}`, 'flags'),
            db.delete(`pid:${pid}:flag:uid:reason`),
            db.deleteObjectFields(`post:${pid}`, ['flag:state', 'flag:assignee', 'flag:notes', 'flag:history']),
        ]);
        yield db.sortedSetsRemoveRangeByScore(['users:flags'], '-inf', 0);
    });
}
