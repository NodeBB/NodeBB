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
    name: 'Store poster count in topic hash',
    timestamp: Date.UTC(2020, 9, 24),
    method: function () {
        return __awaiter(this, void 0, void 0, function* () {
            const { progress } = this;
            yield batch.processSortedSet('topics:tid', (tids) => __awaiter(this, void 0, void 0, function* () {
                progress.incr(tids.length);
                const keys = tids.map(tid => `tid:${tid}:posters`);
                yield database_1.default.sortedSetsRemoveRangeByScore(keys, '-inf', 0);
                const counts = yield database_1.default.sortedSetsCard(keys);
                const bulkSet = [];
                for (let i = 0; i < tids.length; i++) {
                    if (counts[i] > 0) {
                        bulkSet.push([`topic:${tids[i]}`, { postercount: counts[i] }]);
                    }
                }
                yield database_1.default.setObjectBulk(bulkSet);
            }), {
                progress: progress,
                batchSize: 500,
            });
        });
    },
};
