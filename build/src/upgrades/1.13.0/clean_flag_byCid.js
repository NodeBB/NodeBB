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
    name: 'Clean flag byCid zsets',
    timestamp: Date.UTC(2019, 8, 24),
    method: function () {
        return __awaiter(this, void 0, void 0, function* () {
            const { progress } = this;
            yield batch.processSortedSet('flags:datetime', (flagIds) => __awaiter(this, void 0, void 0, function* () {
                progress.incr(flagIds.length);
                const flagData = yield database_1.default.getObjects(flagIds.map(id => `flag:${id}`));
                const bulkRemove = [];
                for (const flagObj of flagData) {
                    if (flagObj && flagObj.type === 'user' && flagObj.targetId && flagObj.flagId) {
                        bulkRemove.push([`flags:byCid:${flagObj.targetId}`, flagObj.flagId]);
                    }
                }
                yield database_1.default.sortedSetRemoveBulk(bulkRemove);
            }), {
                progress: progress,
            });
        });
    },
};
