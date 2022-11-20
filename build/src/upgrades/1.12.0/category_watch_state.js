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
const categories_1 = __importDefault(require("../../categories"));
exports.default = {
    name: 'Update category watch data',
    timestamp: Date.UTC(2018, 11, 13),
    method: function () {
        return __awaiter(this, void 0, void 0, function* () {
            const { progress } = this;
            const cids = yield database_1.default.getSortedSetRange('categories:cid', 0, -1);
            const keys = cids.map((cid) => `cid:${cid}:ignorers`);
            yield batch.processSortedSet('users:joindate', (uids) => __awaiter(this, void 0, void 0, function* () {
                progress.incr(uids.length);
                for (const cid of cids) {
                    const isMembers = yield database_1.default.isSortedSetMembers(`cid:${cid}:ignorers`, uids);
                    uids = uids.filter((uid, index) => isMembers[index]);
                    if (uids.length) {
                        const states = uids.map(() => categories_1.default.watchStates.ignoring);
                        yield database_1.default.sortedSetAdd(`cid:${cid}:uid:watch:state`, states, uids);
                    }
                }
            }), {
                progress: progress,
                batch: 500,
            });
            yield database_1.default.deleteAll(keys);
        });
    },
};
