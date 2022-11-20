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
    name: 'Store tags in topic hash',
    timestamp: Date.UTC(2021, 8, 9),
    method: function () {
        return __awaiter(this, void 0, void 0, function* () {
            const { progress } = this;
            function getTopicsTags(tids) {
                return __awaiter(this, void 0, void 0, function* () {
                    return yield database_1.default.getSetsMembers(tids.map(tid => `topic:${tid}:tags`));
                });
            }
            yield batch.processSortedSet('topics:tid', (tids) => __awaiter(this, void 0, void 0, function* () {
                const tags = yield getTopicsTags(tids);
                const topicsWithTags = tids.map((tid, i) => {
                    const topic = { tid: tid };
                    topic.tags = tags[i];
                    return topic;
                }).filter((t) => t && t.tags.length);
                yield database_1.default.setObjectBulk(topicsWithTags.map((t) => [`topic:${t.tid}`, { tags: t.tags.join(',') }]));
                yield database_1.default.deleteAll(tids.map(tid => `topic:${tid}:tags`));
                progress.incr(tids.length);
            }), {
                batch: 500,
                progress: progress,
            });
        });
    },
};
