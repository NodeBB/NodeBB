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
const database_1 = __importDefault(require("../../database"));
const batch = require('../../batch');
const topics = require('../../topics');
exports.default = {
    name: 'Create category tags sorted sets',
    timestamp: Date.UTC(2020, 10, 23),
    method: function () {
        return __awaiter(this, void 0, void 0, function* () {
            const { progress } = this;
            function getTopicsTags(tids) {
                return __awaiter(this, void 0, void 0, function* () {
                    return yield database_1.default.getSetsMembers(tids.map(tid => `topic:${tid}:tags`));
                });
            }
            yield batch.processSortedSet('topics:tid', (tids) => __awaiter(this, void 0, void 0, function* () {
                const [topicData, tags] = yield Promise.all([
                    topics.getTopicsFields(tids, ['tid', 'cid', 'timestamp']),
                    getTopicsTags(tids),
                ]);
                const topicsWithTags = topicData.map((t, i) => {
                    t.tags = tags[i];
                    return t;
                }).filter((t) => t && t.tags.length);
                yield async.eachSeries(topicsWithTags, (topicObj) => __awaiter(this, void 0, void 0, function* () {
                    const { cid, tags } = topicObj;
                    yield database_1.default.sortedSetsAdd(tags.map(tag => `cid:${cid}:tag:${tag}:topics`), topicObj.timestamp, topicObj.tid);
                    const counts = yield database_1.default.sortedSetsCard(tags.map(tag => `cid:${cid}:tag:${tag}:topics`));
                    yield database_1.default.sortedSetAdd(`cid:${cid}:tags`, counts, tags);
                }));
                progress.incr(tids.length);
            }), {
                batch: 500,
                progress: progress,
            });
        });
    },
};
