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
const nconf_1 = __importDefault(require("nconf"));
const winston_1 = __importDefault(require("winston"));
const user = require('./index');
const groups = require('../groups');
const utils = require('../utils');
const batch = require('../batch');
const database_1 = __importDefault(require("../database"));
const meta_1 = __importDefault(require("../meta"));
const emailer = require('../emailer');
const Password = require('../password');
const UserReset = {};
const twoHours = 7200000;
UserReset.validate = function (code) {
    return __awaiter(this, void 0, void 0, function* () {
        const uid = yield database_1.default.getObjectField('reset:uid', code);
        if (!uid) {
            return false;
        }
        const issueDate = yield database_1.default.sortedSetScore('reset:issueDate', code);
        return parseInt(issueDate, 10) > Date.now() - twoHours;
    });
};
UserReset.generate = function (uid) {
    return __awaiter(this, void 0, void 0, function* () {
        const code = utils.generateUUID();
        // Invalidate past tokens (must be done prior)
        yield UserReset.cleanByUid(uid);
        yield Promise.all([
            database_1.default.setObjectField('reset:uid', code, uid),
            database_1.default.sortedSetAdd('reset:issueDate', Date.now(), code),
        ]);
        return code;
    });
};
function canGenerate(uid) {
    return __awaiter(this, void 0, void 0, function* () {
        const score = yield database_1.default.sortedSetScore('reset:issueDate:uid', uid);
        if (score > Date.now() - (1000 * 60)) {
            throw new Error('[[error:reset-rate-limited]]');
        }
    });
}
UserReset.send = function (email) {
    return __awaiter(this, void 0, void 0, function* () {
        const uid = yield user.getUidByEmail(email);
        if (!uid) {
            throw new Error('[[error:invalid-email]]');
        }
        yield canGenerate(uid);
        yield database_1.default.sortedSetAdd('reset:issueDate:uid', Date.now(), uid);
        const code = yield UserReset.generate(uid);
        yield emailer.send('reset', uid, {
            reset_link: `${nconf_1.default.get('url')}/reset/${code}`,
            subject: '[[email:password-reset-requested]]',
            template: 'reset',
            uid: uid,
        }).catch(err => winston_1.default.error(`[emailer.send] ${err.stack}`));
        return code;
    });
};
UserReset.commit = function (code, password) {
    return __awaiter(this, void 0, void 0, function* () {
        user.isPasswordValid(password);
        const validated = yield UserReset.validate(code);
        if (!validated) {
            throw new Error('[[error:reset-code-not-valid]]');
        }
        const uid = yield database_1.default.getObjectField('reset:uid', code);
        if (!uid) {
            throw new Error('[[error:reset-code-not-valid]]');
        }
        const userData = yield database_1.default.getObjectFields(`user:${uid}`, ['password', 'passwordExpiry', 'password:shaWrapped']);
        const ok = yield Password.compare(password, userData.password, !!parseInt(userData['password:shaWrapped'], 10));
        if (ok) {
            throw new Error('[[error:reset-same-password]]');
        }
        const hash = yield user.hashPassword(password);
        const data = {
            password: hash,
            'password:shaWrapped': 1,
        };
        // don't verify email if password reset is due to expiry
        const isPasswordExpired = userData.passwordExpiry && userData.passwordExpiry < Date.now();
        if (!isPasswordExpired) {
            data['email:confirmed'] = 1;
            yield groups.join('verified-users', uid);
            yield groups.leave('unverified-users', uid);
        }
        yield Promise.all([
            user.setUserFields(uid, data),
            database_1.default.deleteObjectField('reset:uid', code),
            database_1.default.sortedSetRemoveBulk([
                ['reset:issueDate', code],
                ['reset:issueDate:uid', uid],
            ]),
            user.reset.updateExpiry(uid),
            user.auth.resetLockout(uid),
            user.auth.revokeAllSessions(uid),
            user.email.expireValidation(uid),
        ]);
    });
};
UserReset.updateExpiry = function (uid) {
    return __awaiter(this, void 0, void 0, function* () {
        const expireDays = meta_1.default.config.passwordExpiryDays;
        if (expireDays > 0) {
            const oneDay = 1000 * 60 * 60 * 24;
            const expiry = Date.now() + (oneDay * expireDays);
            yield user.setUserField(uid, 'passwordExpiry', expiry);
        }
        else {
            yield database_1.default.deleteObjectField(`user:${uid}`, 'passwordExpiry');
        }
    });
};
UserReset.clean = function () {
    return __awaiter(this, void 0, void 0, function* () {
        const [tokens, uids] = yield Promise.all([
            database_1.default.getSortedSetRangeByScore('reset:issueDate', 0, -1, '-inf', Date.now() - twoHours),
            database_1.default.getSortedSetRangeByScore('reset:issueDate:uid', 0, -1, '-inf', Date.now() - twoHours),
        ]);
        if (!tokens.length && !uids.length) {
            return;
        }
        winston_1.default.verbose(`[UserReset.clean] Removing ${tokens.length} reset tokens from database`);
        yield cleanTokensAndUids(tokens, uids);
    });
};
UserReset.cleanByUid = function (uid) {
    return __awaiter(this, void 0, void 0, function* () {
        const tokensToClean = [];
        uid = parseInt(uid, 10);
        yield batch.processSortedSet('reset:issueDate', (tokens) => __awaiter(this, void 0, void 0, function* () {
            const results = yield database_1.default.getObjectFields('reset:uid', tokens);
            for (const [code, result] of Object.entries(results)) {
                if (parseInt(result, 10) === uid) {
                    tokensToClean.push(code);
                }
            }
        }), { batch: 500 });
        if (!tokensToClean.length) {
            winston_1.default.verbose(`[UserReset.cleanByUid] No tokens found for uid (${uid}).`);
            return;
        }
        winston_1.default.verbose(`[UserReset.cleanByUid] Found ${tokensToClean.length} token(s), removing...`);
        yield cleanTokensAndUids(tokensToClean, uid);
    });
};
function cleanTokensAndUids(tokens, uids) {
    return __awaiter(this, void 0, void 0, function* () {
        yield Promise.all([
            database_1.default.deleteObjectFields('reset:uid', tokens),
            database_1.default.sortedSetRemove('reset:issueDate', tokens),
            database_1.default.sortedSetRemove('reset:issueDate:uid', uids),
        ]);
    });
}
