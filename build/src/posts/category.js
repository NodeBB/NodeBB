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
const topics = require('../topics');
function default_1(Posts) {
    Posts.getCidByPid = function (pid) {
        return __awaiter(this, void 0, void 0, function* () {
            const tid = yield Posts.getPostField(pid, 'tid');
            return yield topics.getTopicField(tid, 'cid');
        });
    };
    Posts.getCidsByPids = function (pids) {
        return __awaiter(this, void 0, void 0, function* () {
            const postData = yield Posts.getPostsFields(pids, ['tid']);
            const tids = _.uniq(postData.map(post => post && post.tid).filter(Boolean));
            const topicData = yield topics.getTopicsFields(tids, ['cid']);
            const tidToTopic = _.zipObject(tids, topicData);
            const cids = postData.map(post => tidToTopic[post.tid] && tidToTopic[post.tid].cid);
            return cids;
        });
    };
    Posts.filterPidsByCid = function (pids, cid) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!cid) {
                return pids;
            }
            if (!Array.isArray(cid) || cid.length === 1) {
                return yield filterPidsBySingleCid(pids, cid);
            }
            const pidsArr = yield Promise.all(cid.map(c => Posts.filterPidsByCid(pids, c)));
            return _.union(...pidsArr);
        });
    };
    function filterPidsBySingleCid(pids, cid) {
        return __awaiter(this, void 0, void 0, function* () {
            const isMembers = yield database_1.default.isSortedSetMembers(`cid:${parseInt(cid, 10)}:pids`, pids);
            return pids.filter((pid, index) => pid && isMembers[index]);
        });
    }
}
exports.default = default_1;
;
