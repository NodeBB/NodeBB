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
const batch = require('../../batch');
const database_1 = __importDefault(require("../../database"));
exports.default = {
    name: 'Add votes to topics',
    timestamp: Date.UTC(2017, 11, 8),
    method: function () {
        return __awaiter(this, void 0, void 0, function* () {
            const { progress } = this;
            batch.processSortedSet('topics:tid', (tids) => __awaiter(this, void 0, void 0, function* () {
                yield Promise.all(tids.map((tid) => __awaiter(this, void 0, void 0, function* () {
                    progress.incr();
                    const topicData = yield database_1.default.getObjectFields(`topic:${tid}`, ['mainPid', 'cid', 'pinned']);
                    if (topicData.mainPid && topicData.cid) {
                        const postData = yield database_1.default.getObject(`post:${topicData.mainPid}`);
                        if (postData) {
                            const upvotes = parseInt(postData.upvotes, 10) || 0;
                            const downvotes = parseInt(postData.downvotes, 10) || 0;
                            const data = {
                                upvotes: upvotes,
                                downvotes: downvotes,
                            };
                            const votes = upvotes - downvotes;
                            yield Promise.all([
                                database_1.default.setObject(`topic:${tid}`, data),
                                database_1.default.sortedSetAdd('topics:votes', votes, tid),
                            ]);
                            if (parseInt(topicData.pinned, 10) !== 1) {
                                yield database_1.default.sortedSetAdd(`cid:${topicData.cid}:tids:votes`, votes, tid);
                            }
                        }
                    }
                })));
            }), {
                progress: progress,
                batch: 500,
            });
        });
    },
};
