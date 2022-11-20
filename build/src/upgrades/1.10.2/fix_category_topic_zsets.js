/* eslint-disable no-await-in-loop */
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
    name: 'Fix category topic zsets',
    timestamp: Date.UTC(2018, 9, 11),
    method: function () {
        return __awaiter(this, void 0, void 0, function* () {
            const { progress } = this;
            const topics = require('../../topics');
            yield batch.processSortedSet('topics:tid', (tids) => __awaiter(this, void 0, void 0, function* () {
                for (const tid of tids) {
                    progress.incr();
                    const topicData = yield database_1.default.getObjectFields(`topic:${tid}`, ['cid', 'pinned', 'postcount']);
                    if (parseInt(topicData.pinned, 10) !== 1) {
                        topicData.postcount = parseInt(topicData.postcount, 10) || 0;
                        yield database_1.default.sortedSetAdd(`cid:${topicData.cid}:tids:posts`, topicData.postcount, tid);
                    }
                    yield topics.updateLastPostTimeFromLastPid(tid);
                }
            }), {
                progress: progress,
            });
        });
    },
};
