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
exports.default = {
    name: 'Re-add deleted topics to topics:recent',
    timestamp: Date.UTC(2018, 9, 11),
    method: function () {
        return __awaiter(this, void 0, void 0, function* () {
            const { progress } = this;
            yield batch.processSortedSet('topics:tid', (tids) => __awaiter(this, void 0, void 0, function* () {
                progress.incr(tids.length);
                const topicData = yield database_1.default.getObjectsFields(tids.map(tid => `topic:${tid}`), ['tid', 'lastposttime', 'viewcount', 'postcount', 'upvotes', 'downvotes']);
                if (!topicData.tid) {
                    return;
                }
                topicData.forEach((t) => {
                    if (t.hasOwnProperty('upvotes') && t.hasOwnProperty('downvotes')) {
                        t.votes = parseInt(t.upvotes, 10) - parseInt(t.downvotes, 10);
                    }
                });
                yield database_1.default.sortedSetAdd('topics:recent', topicData.map((t) => t.lastposttime || 0), topicData.map((t) => t.tid));
                yield database_1.default.sortedSetAdd('topics:views', topicData.map((t) => t.viewcount || 0), topicData.map((t) => t.tid));
                yield database_1.default.sortedSetAdd('topics:posts', topicData.map((t) => t.postcount || 0), topicData.map((t) => t.tid));
                yield database_1.default.sortedSetAdd('topics:votes', topicData.map((t) => t.votes || 0), topicData.map((t) => t.tid));
            }), {
                progress: progress,
                batchSize: 500,
            });
        });
    },
};
