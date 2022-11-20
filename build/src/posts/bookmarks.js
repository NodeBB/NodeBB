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
const database_1 = __importDefault(require("../database"));
const plugins = require('../plugins');
function default_1(Posts) {
    Posts.bookmark = function (pid, uid) {
        return __awaiter(this, void 0, void 0, function* () {
            return yield toggleBookmark('bookmark', pid, uid);
        });
    };
    Posts.unbookmark = function (pid, uid) {
        return __awaiter(this, void 0, void 0, function* () {
            return yield toggleBookmark('unbookmark', pid, uid);
        });
    };
    function toggleBookmark(type, pid, uid) {
        return __awaiter(this, void 0, void 0, function* () {
            if (parseInt(uid, 10) <= 0) {
                throw new Error('[[error:not-logged-in]]');
            }
            const isBookmarking = type === 'bookmark';
            const [postData, hasBookmarked] = yield Promise.all([
                Posts.getPostFields(pid, ['pid', 'uid']),
                Posts.hasBookmarked(pid, uid),
            ]);
            if (isBookmarking && hasBookmarked) {
                throw new Error('[[error:already-bookmarked]]');
            }
            if (!isBookmarking && !hasBookmarked) {
                throw new Error('[[error:already-unbookmarked]]');
            }
            if (isBookmarking) {
                yield database_1.default.sortedSetAdd(`uid:${uid}:bookmarks`, Date.now(), pid);
            }
            else {
                yield database_1.default.sortedSetRemove(`uid:${uid}:bookmarks`, pid);
            }
            yield database_1.default[isBookmarking ? 'setAdd' : 'setRemove'](`pid:${pid}:users_bookmarked`, uid);
            postData.bookmarks = yield database_1.default.setCount(`pid:${pid}:users_bookmarked`);
            yield Posts.setPostField(pid, 'bookmarks', postData.bookmarks);
            plugins.hooks.fire(`action:post.${type}`, {
                pid: pid,
                uid: uid,
                owner: postData.uid,
                current: hasBookmarked ? 'bookmarked' : 'unbookmarked',
            });
            return {
                post: postData,
                isBookmarked: isBookmarking,
            };
        });
    }
    Posts.hasBookmarked = function (pid, uid) {
        return __awaiter(this, void 0, void 0, function* () {
            if (parseInt(uid, 10) <= 0) {
                return Array.isArray(pid) ? pid.map(() => false) : false;
            }
            if (Array.isArray(pid)) {
                const sets = pid.map(pid => `pid:${pid}:users_bookmarked`);
                return yield database_1.default.isMemberOfSets(sets, uid);
            }
            return yield database_1.default.isSetMember(`pid:${pid}:users_bookmarked`, uid);
        });
    };
}
exports.default = default_1;
;
