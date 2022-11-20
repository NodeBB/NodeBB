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
const batch = require('../../batch');
const database_1 = __importDefault(require("../../database"));
const groups = require('../../groups');
const now = Date.now();
exports.default = {
    name: 'Move banned users to banned-users group',
    timestamp: Date.UTC(2020, 11, 13),
    method: function () {
        return __awaiter(this, void 0, void 0, function* () {
            const { progress } = this;
            const timestamp = yield database_1.default.getObjectField('group:administrators', 'timestamp');
            const bannedExists = yield groups.exists('banned-users');
            if (!bannedExists) {
                yield groups.create({
                    name: 'banned-users',
                    hidden: 1,
                    private: 1,
                    system: 1,
                    disableLeave: 1,
                    disableJoinRequests: 1,
                    timestamp: timestamp + 1,
                });
            }
            yield batch.processSortedSet('users:banned', (uids) => __awaiter(this, void 0, void 0, function* () {
                progress.incr(uids.length);
                yield database_1.default.sortedSetAdd('group:banned-users:members', uids.map(() => now), uids);
                yield database_1.default.sortedSetRemove([
                    'group:registered-users:members',
                    'group:verified-users:members',
                    'group:unverified-users:members',
                    'group:Global Moderators:members',
                ], uids);
            }), {
                batch: 500,
                progress: this.progress,
            });
            const bannedCount = yield database_1.default.sortedSetCard('group:banned-users:members');
            const registeredCount = yield database_1.default.sortedSetCard('group:registered-users:members');
            const verifiedCount = yield database_1.default.sortedSetCard('group:verified-users:members');
            const unverifiedCount = yield database_1.default.sortedSetCard('group:unverified-users:members');
            const globalModCount = yield database_1.default.sortedSetCard('group:Global Moderators:members');
            yield database_1.default.setObjectField('group:banned-users', 'memberCount', bannedCount);
            yield database_1.default.setObjectField('group:registered-users', 'memberCount', registeredCount);
            yield database_1.default.setObjectField('group:verified-users', 'memberCount', verifiedCount);
            yield database_1.default.setObjectField('group:unverified-users', 'memberCount', unverifiedCount);
            yield database_1.default.setObjectField('group:Global Moderators', 'memberCount', globalModCount);
        });
    },
};
