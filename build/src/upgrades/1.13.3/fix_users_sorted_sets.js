'use strict';
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
const database = __importStar(require("../../database"));
const db = database;
const batch = require('../../batch');
exports.default = {
    name: 'Fix user sorted sets',
    timestamp: Date.UTC(2020, 4, 2),
    method: function () {
        return __awaiter(this, void 0, void 0, function* () {
            const { progress } = this;
            const nextUid = yield db.getObjectField('global', 'nextUid');
            const allUids = [];
            for (let i = 1; i <= nextUid; i++) {
                allUids.push(i);
            }
            progress.total = nextUid;
            let totalUserCount = 0;
            yield db.delete('user:null');
            yield db.sortedSetsRemove([
                'users:joindate',
                'users:reputation',
                'users:postcount',
                'users:flags',
            ], 'null');
            yield batch.processArray(allUids, (uids) => __awaiter(this, void 0, void 0, function* () {
                progress.incr(uids.length);
                const userData = yield db.getObjects(uids.map(id => `user:${id}`));
                yield Promise.all(userData.map((userData, index) => __awaiter(this, void 0, void 0, function* () {
                    if (!userData || !userData.uid) {
                        yield db.sortedSetsRemove([
                            'users:joindate',
                            'users:reputation',
                            'users:postcount',
                            'users:flags',
                        ], uids[index]);
                        if (userData && !userData.uid) {
                            yield db.delete(`user:${uids[index]}`);
                        }
                        return;
                    }
                    totalUserCount += 1;
                    yield db.sortedSetAddBulk([
                        ['users:joindate', userData.joindate || Date.now(), uids[index]],
                        ['users:reputation', userData.reputation || 0, uids[index]],
                        ['users:postcount', userData.postcount || 0, uids[index]],
                    ]);
                    if (userData.hasOwnProperty('flags') && parseInt(userData.flags, 10) > 0) {
                        yield db.sortedSetAdd('users:flags', userData.flags, uids[index]);
                    }
                })));
            }), {
                progress: progress,
                batch: 500,
            });
            yield db.setObjectField('global', 'userCount', totalUserCount);
        });
    },
};
