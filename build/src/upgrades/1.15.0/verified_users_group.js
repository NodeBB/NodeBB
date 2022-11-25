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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const database = __importStar(require("../../database"));
const db = database;
const batch = require('../../batch');
const user_1 = __importDefault(require("../../user"));
const groups = require('../../groups');
const meta_1 = __importDefault(require("../../meta"));
const privileges = require('../../privileges');
const now = Date.now();
exports.default = {
    name: 'Create verified/unverified user groups',
    timestamp: Date.UTC(2020, 9, 13),
    method: function () {
        return __awaiter(this, void 0, void 0, function* () {
            const { progress } = this;
            const maxGroupLength = meta_1.default.config.maximumGroupNameLength;
            meta_1.default.config.maximumGroupNameLength = 30;
            const timestamp = yield db.getObjectField('group:administrators', 'timestamp');
            const verifiedExists = yield groups.exists('verified-users');
            if (!verifiedExists) {
                yield groups.create({
                    name: 'verified-users',
                    hidden: 1,
                    private: 1,
                    system: 1,
                    disableLeave: 1,
                    disableJoinRequests: 1,
                    timestamp: timestamp + 1,
                });
            }
            const unverifiedExists = yield groups.exists('unverified-users');
            if (!unverifiedExists) {
                yield groups.create({
                    name: 'unverified-users',
                    hidden: 1,
                    private: 1,
                    system: 1,
                    disableLeave: 1,
                    disableJoinRequests: 1,
                    timestamp: timestamp + 1,
                });
            }
            // restore setting
            meta_1.default.config.maximumGroupNameLength = maxGroupLength;
            yield batch.processSortedSet('users:joindate', (uids) => __awaiter(this, void 0, void 0, function* () {
                progress.incr(uids.length);
                const userData = yield user_1.default.getUsersFields(uids, ['uid', 'email:confirmed']);
                const verified = userData.filter(u => parseInt(u['email:confirmed'], 10) === 1);
                const unverified = userData.filter(u => parseInt(u['email:confirmed'], 10) !== 1);
                yield db.sortedSetAdd('group:verified-users:members', verified.map(() => now), verified.map(u => u.uid));
                yield db.sortedSetAdd('group:unverified-users:members', unverified.map(() => now), unverified.map(u => u.uid));
            }), {
                batch: 500,
                progress: this.progress,
            });
            yield db.delete('users:notvalidated');
            yield updatePrivilges();
            const verifiedCount = yield db.sortedSetCard('group:verified-users:members');
            const unverifiedCount = yield db.sortedSetCard('group:unverified-users:members');
            yield db.setObjectField('group:verified-users', 'memberCount', verifiedCount);
            yield db.setObjectField('group:unverified-users', 'memberCount', unverifiedCount);
        });
    },
};
function updatePrivilges() {
    return __awaiter(this, void 0, void 0, function* () {
        // if email confirmation is required
        //   give chat, posting privs to "verified-users" group
        //   remove chat, posting privs from "registered-users" group
        // This config property has been removed from v1.18.0+, but is still present in old datasets
        if (meta_1.default.config.requireEmailConfirmation) {
            const cids = yield db.getSortedSetRevRange('categories:cid', 0, -1);
            const canChat = yield privileges.global.canGroup('chat', 'registered-users');
            if (canChat) {
                yield privileges.global.give(['groups:chat'], 'verified-users');
                yield privileges.global.rescind(['groups:chat'], 'registered-users');
            }
            for (const cid of cids) {
                /* eslint-disable no-await-in-loop */
                const data = yield privileges.categories.list(cid);
                const registeredUsersPrivs = data.groups.find((d) => d.name === 'registered-users').privileges;
                if (registeredUsersPrivs['groups:topics:create']) {
                    yield privileges.categories.give(['groups:topics:create'], cid, 'verified-users');
                    yield privileges.categories.rescind(['groups:topics:create'], cid, 'registered-users');
                }
                if (registeredUsersPrivs['groups:topics:reply']) {
                    yield privileges.categories.give(['groups:topics:reply'], cid, 'verified-users');
                    yield privileges.categories.rescind(['groups:topics:reply'], cid, 'registered-users');
                }
            }
        }
    });
}
