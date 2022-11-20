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
const async = require('async');
const database_1 = __importDefault(require("../database"));
const user_1 = __importDefault(require("../user"));
function default_1(Topics) {
    Topics.getUserBookmark = function (tid, uid) {
        return __awaiter(this, void 0, void 0, function* () {
            if (parseInt(uid, 10) <= 0) {
                return null;
            }
            return yield database_1.default.sortedSetScore(`tid:${tid}:bookmarks`, uid);
        });
    };
    Topics.getUserBookmarks = function (tids, uid) {
        return __awaiter(this, void 0, void 0, function* () {
            if (parseInt(uid, 10) <= 0) {
                return tids.map(() => null);
            }
            return yield database_1.default.sortedSetsScore(tids.map(tid => `tid:${tid}:bookmarks`), uid);
        });
    };
    Topics.setUserBookmark = function (tid, uid, index) {
        return __awaiter(this, void 0, void 0, function* () {
            yield database_1.default.sortedSetAdd(`tid:${tid}:bookmarks`, index, uid);
        });
    };
    Topics.getTopicBookmarks = function (tid) {
        return __awaiter(this, void 0, void 0, function* () {
            return yield database_1.default.getSortedSetRangeWithScores(`tid:${tid}:bookmarks`, 0, -1);
        });
    };
    Topics.updateTopicBookmarks = function (tid, pids) {
        return __awaiter(this, void 0, void 0, function* () {
            const maxIndex = yield Topics.getPostCount(tid);
            const indices = yield database_1.default.sortedSetRanks(`tid:${tid}:posts`, pids);
            const postIndices = indices.map((i) => (i === null ? 0 : i + 1));
            const minIndex = Math.min(...postIndices);
            const bookmarks = yield Topics.getTopicBookmarks(tid);
            const uidData = bookmarks.map(b => ({ uid: b.value, bookmark: parseInt(b.score, 10) }))
                .filter(data => data.bookmark >= minIndex);
            yield async.eachLimit(uidData, 50, (data) => __awaiter(this, void 0, void 0, function* () {
                let bookmark = Math.min(data.bookmark, maxIndex);
                postIndices.forEach((i) => {
                    if (i < data.bookmark) {
                        bookmark -= 1;
                    }
                });
                // make sure the bookmark is valid if we removed the last post
                bookmark = Math.min(bookmark, maxIndex - pids.length);
                if (bookmark === data.bookmark) {
                    return;
                }
                const settings = yield user_1.default.getSettings(data.uid);
                if (settings.topicPostSort === 'most_votes') {
                    return;
                }
                yield Topics.setUserBookmark(tid, data.uid, bookmark);
            }));
        });
    };
}
exports.default = default_1;
;
