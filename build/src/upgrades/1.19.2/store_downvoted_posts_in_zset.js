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
exports.default = {
    name: 'Store downvoted posts in user votes sorted set',
    timestamp: Date.UTC(2022, 1, 4),
    method: function () {
        return __awaiter(this, void 0, void 0, function* () {
            const batch = require('../../batch');
            const posts = require('../../posts');
            const { progress } = this;
            yield batch.processSortedSet('posts:pid', (pids) => __awaiter(this, void 0, void 0, function* () {
                const postData = yield posts.getPostsFields(pids, ['pid', 'uid', 'upvotes', 'downvotes']);
                const cids = yield posts.getCidsByPids(pids);
                const bulkAdd = [];
                postData.forEach((post, index) => {
                    if (post.votes > 0 || post.votes < 0) {
                        const cid = cids[index];
                        bulkAdd.push([`cid:${cid}:uid:${post.uid}:pids:votes`, post.votes, post.pid]);
                    }
                });
                yield database_1.default.sortedSetAddBulk(bulkAdd);
                progress.incr(postData.length);
            }), {
                progress,
                batch: 500,
            });
        });
    },
};
