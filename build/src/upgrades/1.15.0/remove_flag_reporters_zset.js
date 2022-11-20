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
    name: 'Remove flag reporters sorted set',
    timestamp: Date.UTC(2020, 6, 31),
    method: function () {
        return __awaiter(this, void 0, void 0, function* () {
            const { progress } = this;
            progress.total = yield database_1.default.sortedSetCard('flags:datetime');
            yield batch.processSortedSet('flags:datetime', (flagIds) => __awaiter(this, void 0, void 0, function* () {
                yield Promise.all(flagIds.map((flagId) => __awaiter(this, void 0, void 0, function* () {
                    const [reports, reporterUids] = yield Promise.all([
                        database_1.default.getSortedSetRevRangeWithScores(`flag:${flagId}:reports`, 0, -1),
                        database_1.default.getSortedSetRevRange(`flag:${flagId}:reporters`, 0, -1),
                    ]);
                    const values = reports.reduce((memo, cur, idx) => {
                        memo.push([`flag:${flagId}:reports`, cur.score, [(reporterUids[idx] || 0), cur.value].join(';')]);
                        return memo;
                    }, []);
                    yield database_1.default.delete(`flag:${flagId}:reports`);
                    yield database_1.default.sortedSetAddBulk(values);
                })));
            }), {
                batch: 500,
                progress: progress,
            });
        });
    },
};
