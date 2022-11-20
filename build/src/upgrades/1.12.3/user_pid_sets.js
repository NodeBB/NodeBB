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
const database_1 = __importDefault(require("../../database"));
const batch = require('../../batch');
const posts = require('../../posts');
const topics = require('../../topics');
exports.default = {
    name: 'Create zsets for user posts per category',
    timestamp: Date.UTC(2019, 5, 23),
    method: function () {
        return __awaiter(this, void 0, void 0, function* () {
            const { progress } = this;
            yield batch.processSortedSet('posts:pid', (pids) => __awaiter(this, void 0, void 0, function* () {
                progress.incr(pids.length);
                const postData = yield posts.getPostsFields(pids, ['pid', 'uid', 'tid', 'upvotes', 'downvotes', 'timestamp']);
                const tids = postData.map(p => p.tid);
                const topicData = yield topics.getTopicsFields(tids, ['cid']);
                const bulk = [];
                postData.forEach((p, index) => {
                    if (p && p.uid && p.pid && p.tid && p.timestamp) {
                        bulk.push([`cid:${topicData[index].cid}:uid:${p.uid}:pids`, p.timestamp, p.pid]);
                        if (p.votes > 0) {
                            bulk.push([`cid:${topicData[index].cid}:uid:${p.uid}:pids:votes`, p.votes, p.pid]);
                        }
                    }
                });
                yield database_1.default.sortedSetAddBulk(bulk);
            }), {
                progress: progress,
            });
        });
    },
};
