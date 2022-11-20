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
const topics = require('../topics');
const user_1 = __importDefault(require("../user"));
const utils = require('../utils');
function default_1(Posts) {
    Posts.getPostsFromSet = function (set, start, stop, uid, reverse) {
        return __awaiter(this, void 0, void 0, function* () {
            const pids = yield Posts.getPidsFromSet(set, start, stop, reverse);
            const posts = yield Posts.getPostsByPids(pids, uid);
            return yield user_1.default.blocks.filter(uid, posts);
        });
    };
    Posts.isMain = function (pids) {
        return __awaiter(this, void 0, void 0, function* () {
            const isArray = Array.isArray(pids);
            pids = isArray ? pids : [pids];
            const postData = yield Posts.getPostsFields(pids, ['tid']);
            const topicData = yield topics.getTopicsFields(postData.map((t) => t.tid), ['mainPid']);
            const result = pids.map((pid, i) => parseInt(pid, 10) === parseInt(topicData[i].mainPid, 10));
            return isArray ? result : result[0];
        });
    };
    Posts.getTopicFields = function (pid, fields) {
        return __awaiter(this, void 0, void 0, function* () {
            const tid = yield Posts.getPostField(pid, 'tid');
            return yield topics.getTopicFields(tid, fields);
        });
    };
    Posts.generatePostPath = function (pid, uid) {
        return __awaiter(this, void 0, void 0, function* () {
            const paths = yield Posts.generatePostPaths([pid], uid);
            return Array.isArray(paths) && paths.length ? paths[0] : null;
        });
    };
    Posts.generatePostPaths = function (pids, uid) {
        return __awaiter(this, void 0, void 0, function* () {
            const postData = yield Posts.getPostsFields(pids, ['pid', 'tid']);
            const tids = postData.map(post => post && post.tid);
            const [indices, topicData] = yield Promise.all([
                Posts.getPostIndices(postData, uid),
                topics.getTopicsFields(tids, ['slug']),
            ]);
            const paths = pids.map((pid, index) => {
                const slug = topicData[index] ? topicData[index].slug : null;
                const postIndex = utils.isNumber(indices[index]) ? parseInt(indices[index], 10) + 1 : null;
                if (slug && postIndex) {
                    return `/topic/${slug}/${postIndex}`;
                }
                return null;
            });
            return paths;
        });
    };
}
exports.default = default_1;
;
