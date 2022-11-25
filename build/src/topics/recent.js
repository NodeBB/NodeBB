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
Object.defineProperty(exports, "__esModule", { value: true });
const database = __importStar(require("../database"));
const db = database;
const plugins = require('../plugins');
const posts = require('../posts');
function default_1(Topics) {
    const terms = {
        day: 86400000,
        week: 604800000,
        month: 2592000000,
        year: 31104000000,
    };
    Topics.getRecentTopics = function (cid, uid, start, stop, filter) {
        return __awaiter(this, void 0, void 0, function* () {
            return yield Topics.getSortedTopics({
                cids: cid,
                uid: uid,
                start: start,
                stop: stop,
                filter: filter,
                sort: 'recent',
            });
        });
    };
    /* not an orphan method, used in widget-essentials */
    Topics.getLatestTopics = function (options) {
        return __awaiter(this, void 0, void 0, function* () {
            // uid, start, stop, term
            const tids = yield Topics.getLatestTidsFromSet('topics:recent', options.start, options.stop, options.term);
            const topics = yield Topics.getTopics(tids, options);
            return { topics: topics, nextStart: options.stop + 1 };
        });
    };
    Topics.getLatestTidsFromSet = function (set, start, stop, term) {
        return __awaiter(this, void 0, void 0, function* () {
            let since = terms.day;
            if (terms[term]) {
                since = terms[term];
            }
            const count = parseInt(stop, 10) === -1 ? stop : stop - start + 1;
            return yield db.getSortedSetRevRangeByScore(set, start, count, '+inf', Date.now() - since);
        });
    };
    Topics.updateLastPostTimeFromLastPid = function (tid) {
        return __awaiter(this, void 0, void 0, function* () {
            const pid = yield Topics.getLatestUndeletedPid(tid);
            if (!pid) {
                return;
            }
            const timestamp = yield posts.getPostField(pid, 'timestamp');
            if (!timestamp) {
                return;
            }
            yield Topics.updateLastPostTime(tid, timestamp);
        });
    };
    Topics.updateLastPostTime = function (tid, lastposttime) {
        return __awaiter(this, void 0, void 0, function* () {
            yield Topics.setTopicField(tid, 'lastposttime', lastposttime);
            const topicData = yield Topics.getTopicFields(tid, ['cid', 'deleted', 'pinned']);
            yield db.sortedSetAdd(`cid:${topicData.cid}:tids:lastposttime`, lastposttime, tid);
            yield Topics.updateRecent(tid, lastposttime);
            if (!topicData.pinned) {
                yield db.sortedSetAdd(`cid:${topicData.cid}:tids`, lastposttime, tid);
            }
        });
    };
    Topics.updateRecent = function (tid, timestamp) {
        return __awaiter(this, void 0, void 0, function* () {
            let data = { tid: tid, timestamp: timestamp };
            if (plugins.hooks.hasListeners('filter:topics.updateRecent')) {
                data = yield plugins.hooks.fire('filter:topics.updateRecent', { tid: tid, timestamp: timestamp });
            }
            if (data && data.tid && data.timestamp) {
                yield db.sortedSetAdd('topics:recent', data.timestamp, data.tid);
            }
        });
    };
}
exports.default = default_1;
;
