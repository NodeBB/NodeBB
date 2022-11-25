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
const batch = require('../../batch');
const database = __importStar(require("../../database"));
const db = database;
const groups = require('../../groups');
const now = Date.now();
exports.default = {
    name: 'Move banned users to banned-users group',
    timestamp: Date.UTC(2020, 11, 13),
    method: function () {
        return __awaiter(this, void 0, void 0, function* () {
            const { progress } = this;
            const timestamp = yield db.getObjectField('group:administrators', 'timestamp');
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
                yield db.sortedSetAdd('group:banned-users:members', uids.map(() => now), uids);
                yield db.sortedSetRemove([
                    'group:registered-users:members',
                    'group:verified-users:members',
                    'group:unverified-users:members',
                    'group:Global Moderators:members',
                ], uids);
            }), {
                batch: 500,
                progress: this.progress,
            });
            const bannedCount = yield db.sortedSetCard('group:banned-users:members');
            const registeredCount = yield db.sortedSetCard('group:registered-users:members');
            const verifiedCount = yield db.sortedSetCard('group:verified-users:members');
            const unverifiedCount = yield db.sortedSetCard('group:unverified-users:members');
            const globalModCount = yield db.sortedSetCard('group:Global Moderators:members');
            yield db.setObjectField('group:banned-users', 'memberCount', bannedCount);
            yield db.setObjectField('group:registered-users', 'memberCount', registeredCount);
            yield db.setObjectField('group:verified-users', 'memberCount', verifiedCount);
            yield db.setObjectField('group:unverified-users', 'memberCount', unverifiedCount);
            yield db.setObjectField('group:Global Moderators', 'memberCount', globalModCount);
        });
    },
};
