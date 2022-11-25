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
const winston_1 = __importDefault(require("winston"));
const validator = require('validator');
const util = require('util');
const _ = require('lodash');
const database = __importStar(require("../database"));
const db = database;
const meta_1 = __importDefault(require("../meta"));
const events = require('../events');
const batch = require('../batch');
const utils = require('../utils');
function default_1(User) {
    User.auth = {};
    User.auth.logAttempt = function (uid, ip) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!(parseInt(uid, 10) > 0)) {
                return;
            }
            const exists = yield db.exists(`lockout:${uid}`);
            if (exists) {
                throw new Error('[[error:account-locked]]');
            }
            const attempts = yield db.increment(`loginAttempts:${uid}`);
            if (attempts <= meta_1.default.config.loginAttempts) {
                return yield db.pexpire(`loginAttempts:${uid}`, 1000 * 60 * 60);
            }
            // Lock out the account
            yield db.set(`lockout:${uid}`, '');
            const duration = 1000 * 60 * meta_1.default.config.lockoutDuration;
            yield db.delete(`loginAttempts:${uid}`);
            yield db.pexpire(`lockout:${uid}`, duration);
            yield events.log({
                type: 'account-locked',
                uid: uid,
                ip: ip,
            });
            throw new Error('[[error:account-locked]]');
        });
    };
    User.auth.getFeedToken = function (uid) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!(parseInt(uid, 10) > 0)) {
                return;
            }
            const _token = yield db.getObjectField(`user:${uid}`, 'rss_token');
            const token = _token || utils.generateUUID();
            if (!_token) {
                yield User.setUserField(uid, 'rss_token', token);
            }
            return token;
        });
    };
    User.auth.clearLoginAttempts = function (uid) {
        return __awaiter(this, void 0, void 0, function* () {
            yield db.delete(`loginAttempts:${uid}`);
        });
    };
    User.auth.resetLockout = function (uid) {
        return __awaiter(this, void 0, void 0, function* () {
            yield db.deleteAll([
                `loginAttempts:${uid}`,
                `lockout:${uid}`,
            ]);
        });
    };
    const getSessionFromStore = util.promisify((sid, callback) => db.sessionStore.get(sid, (err, sessObj) => callback(err, sessObj || null)));
    const sessionStoreDestroy = util.promisify((sid, callback) => db.sessionStore.destroy(sid, (err) => callback(err)));
    User.auth.getSessions = function (uid, curSessionId) {
        return __awaiter(this, void 0, void 0, function* () {
            yield cleanExpiredSessions(uid);
            const sids = yield db.getSortedSetRevRange(`uid:${uid}:sessions`, 0, 19);
            let sessions = yield Promise.all(sids.map((sid) => getSessionFromStore(sid)));
            sessions = sessions.map((sessObj, idx) => {
                if (sessObj && sessObj.meta) {
                    sessObj.meta.current = curSessionId === sids[idx];
                    sessObj.meta.datetimeISO = new Date(sessObj.meta.datetime).toISOString();
                    sessObj.meta.ip = validator.escape(String(sessObj.meta.ip));
                }
                return sessObj && sessObj.meta;
            }).filter(Boolean);
            return sessions;
        });
    };
    function cleanExpiredSessions(uid) {
        return __awaiter(this, void 0, void 0, function* () {
            const uuidMapping = yield db.getObject(`uid:${uid}:sessionUUID:sessionId`);
            if (!uuidMapping) {
                return;
            }
            const expiredUUIDs = [];
            const expiredSids = [];
            yield Promise.all(Object.keys(uuidMapping).map((uuid) => __awaiter(this, void 0, void 0, function* () {
                const sid = uuidMapping[uuid];
                const sessionObj = yield getSessionFromStore(sid);
                const expired = !sessionObj || !sessionObj.hasOwnProperty('passport') ||
                    !sessionObj.passport.hasOwnProperty('user') ||
                    parseInt(sessionObj.passport.user, 10) !== parseInt(uid, 10);
                if (expired) {
                    expiredUUIDs.push(uuid);
                    expiredSids.push(sid);
                }
            })));
            yield db.deleteObjectFields(`uid:${uid}:sessionUUID:sessionId`, expiredUUIDs);
            yield db.sortedSetRemove(`uid:${uid}:sessions`, expiredSids);
        });
    }
    User.auth.addSession = function (uid, sessionId) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!(parseInt(uid, 10) > 0)) {
                return;
            }
            yield cleanExpiredSessions(uid);
            yield db.sortedSetAdd(`uid:${uid}:sessions`, Date.now(), sessionId);
            yield revokeSessionsAboveThreshold(uid, meta_1.default.config.maxUserSessions);
        });
    };
    function revokeSessionsAboveThreshold(uid, maxUserSessions) {
        return __awaiter(this, void 0, void 0, function* () {
            const activeSessions = yield db.getSortedSetRange(`uid:${uid}:sessions`, 0, -1);
            if (activeSessions.length > maxUserSessions) {
                const sessionsToRevoke = activeSessions.slice(0, activeSessions.length - maxUserSessions);
                yield Promise.all(sessionsToRevoke.map((sessionId) => User.auth.revokeSession(sessionId, uid)));
            }
        });
    }
    User.auth.revokeSession = function (sessionId, uid) {
        return __awaiter(this, void 0, void 0, function* () {
            winston_1.default.verbose(`[user.auth] Revoking session ${sessionId} for user ${uid}`);
            const sessionObj = yield getSessionFromStore(sessionId);
            if (sessionObj && sessionObj.meta && sessionObj.meta.uuid) {
                yield db.deleteObjectField(`uid:${uid}:sessionUUID:sessionId`, sessionObj.meta.uuid);
            }
            yield Promise.all([
                db.sortedSetRemove(`uid:${uid}:sessions`, sessionId),
                sessionStoreDestroy(sessionId),
            ]);
        });
    };
    User.auth.revokeAllSessions = function (uids, except) {
        return __awaiter(this, void 0, void 0, function* () {
            uids = Array.isArray(uids) ? uids : [uids];
            const sids = yield db.getSortedSetsMembers(uids.map(uid => `uid:${uid}:sessions`));
            const promises = [];
            uids.forEach((uid, index) => {
                const ids = sids[index].filter((id) => id !== except);
                if (ids.length) {
                    promises.push(ids.map((s) => User.auth.revokeSession(s, uid)));
                }
            });
            yield Promise.all(promises);
        });
    };
    User.auth.deleteAllSessions = function () {
        return __awaiter(this, void 0, void 0, function* () {
            yield batch.processSortedSet('users:joindate', (uids) => __awaiter(this, void 0, void 0, function* () {
                const sessionKeys = uids.map((uid) => `uid:${uid}:sessions`);
                const sessionUUIDKeys = uids.map((uid) => `uid:${uid}:sessionUUID:sessionId`);
                const sids = _.flatten(yield db.getSortedSetRange(sessionKeys, 0, -1));
                yield Promise.all([
                    db.deleteAll(sessionKeys.concat(sessionUUIDKeys)),
                    ...sids.map((sid) => sessionStoreDestroy(sid)),
                ]);
            }), { batch: 1000 });
        });
    };
}
exports.default = default_1;
;
