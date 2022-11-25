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
const database = __importStar(require("../../database"));
const db = database;
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
                yield db.sortedSetAddBulk(bulk);
            }), {
                progress: progress,
            });
        });
    },
};
