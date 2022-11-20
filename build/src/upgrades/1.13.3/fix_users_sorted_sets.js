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
    name: 'Fix user sorted sets',
    timestamp: Date.UTC(2020, 4, 2),
    method: function () {
        return __awaiter(this, void 0, void 0, function* () {
            const { progress } = this;
            const nextUid = yield database_1.default.getObjectField('global', 'nextUid');
            const allUids = [];
            for (let i = 1; i <= nextUid; i++) {
                allUids.push(i);
            }
            progress.total = nextUid;
            let totalUserCount = 0;
            yield database_1.default.delete('user:null');
            yield database_1.default.sortedSetsRemove([
                'users:joindate',
                'users:reputation',
                'users:postcount',
                'users:flags',
            ], 'null');
            yield batch.processArray(allUids, (uids) => __awaiter(this, void 0, void 0, function* () {
                progress.incr(uids.length);
                const userData = yield database_1.default.getObjects(uids.map(id => `user:${id}`));
                yield Promise.all(userData.map((userData, index) => __awaiter(this, void 0, void 0, function* () {
                    if (!userData || !userData.uid) {
                        yield database_1.default.sortedSetsRemove([
                            'users:joindate',
                            'users:reputation',
                            'users:postcount',
                            'users:flags',
                        ], uids[index]);
                        if (userData && !userData.uid) {
                            yield database_1.default.delete(`user:${uids[index]}`);
                        }
                        return;
                    }
                    totalUserCount += 1;
                    yield database_1.default.sortedSetAddBulk([
                        ['users:joindate', userData.joindate || Date.now(), uids[index]],
                        ['users:reputation', userData.reputation || 0, uids[index]],
                        ['users:postcount', userData.postcount || 0, uids[index]],
                    ]);
                    if (userData.hasOwnProperty('flags') && parseInt(userData.flags, 10) > 0) {
                        yield database_1.default.sortedSetAdd('users:flags', userData.flags, uids[index]);
                    }
                })));
            }), {
                progress: progress,
                batch: 500,
            });
            yield database_1.default.setObjectField('global', 'userCount', totalUserCount);
        });
    },
};
