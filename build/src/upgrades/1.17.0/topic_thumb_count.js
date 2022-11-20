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
const _ = require('lodash');
const database_1 = __importDefault(require("../../database"));
const batch = require('../../batch');
exports.default = {
    name: 'Store number of thumbs a topic has in the topic object',
    timestamp: Date.UTC(2021, 1, 7),
    method: function () {
        return __awaiter(this, void 0, void 0, function* () {
            const { progress } = this;
            yield batch.processSortedSet('topics:tid', (tids) => __awaiter(this, void 0, void 0, function* () {
                const keys = tids.map(tid => `topic:${tid}:thumbs`);
                const counts = yield database_1.default.sortedSetsCard(keys);
                const tidToCount = _.zipObject(tids, counts);
                const tidsWithThumbs = tids.filter((t, i) => counts[i] > 0);
                yield database_1.default.setObjectBulk(tidsWithThumbs.map(tid => [`topic:${tid}`, { numThumbs: tidToCount[tid] }]));
                progress.incr(tids.length);
            }), {
                batch: 500,
                progress: progress,
            });
        });
    },
};
