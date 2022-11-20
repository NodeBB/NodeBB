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
const privileges = require('../privileges');
function default_1(Posts) {
    const terms = {
        day: 86400000,
        week: 604800000,
        month: 2592000000,
    };
    Posts.getRecentPosts = function (uid, start, stop, term) {
        return __awaiter(this, void 0, void 0, function* () {
            let min = 0;
            if (terms[term]) {
                min = Date.now() - terms[term];
            }
            const count = parseInt(stop, 10) === -1 ? stop : stop - start + 1;
            let pids = yield database_1.default.getSortedSetRevRangeByScore('posts:pid', start, count, '+inf', min);
            pids = yield privileges.posts.filter('topics:read', pids, uid);
            return yield Posts.getPostSummaryByPids(pids, uid, { stripTags: true });
        });
    };
    Posts.getRecentPosterUids = function (start, stop) {
        return __awaiter(this, void 0, void 0, function* () {
            const pids = yield database_1.default.getSortedSetRevRange('posts:pid', start, stop);
            const postData = yield Posts.getPostsFields(pids, ['uid']);
            return _.uniq(postData.map(p => p && p.uid).filter(uid => parseInt(uid, 10)));
        });
    };
}
exports.default = default_1;
;
