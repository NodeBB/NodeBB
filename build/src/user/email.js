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
const utils = require('../utils');
const plugins = require('../plugins');
const database_1 = __importDefault(require("../database"));
const meta_1 = __importDefault(require("../meta"));
const emailer = require('../emailer');
const groups = require('../groups');
const events = require('../events');
const UserEmail = {};
UserEmail.exists = function (email) {
    return __awaiter(this, void 0, void 0, function* () {
        const uid = yield user.getUidByEmail(email.toLowerCase());
        return !!uid;
    });
};
UserEmail.available = function (email) {
    return __awaiter(this, void 0, void 0, function* () {
        const exists = yield database_1.default.isSortedSetMember('email:uid', email.toLowerCase());
        return !exists;
    });
};
UserEmail.remove = function (uid, sessionId) {
    return __awaiter(this, void 0, void 0, function* () {
        const email = yield user.getUserField(uid, 'email');
        if (!email) {
            return;
        }
        yield Promise.all([
            user.setUserFields(uid, {
                email: '',
                'email:confirmed': 0,
            }),
            database_1.default.sortedSetRemove('email:uid', email.toLowerCase()),
            database_1.default.sortedSetRemove('email:sorted', `${email.toLowerCase()}:${uid}`),
            user.email.expireValidation(uid),
            user.auth.revokeAllSessions(uid, sessionId),
            events.log({ type: 'email-change', email, newEmail: '' }),
        ]);
    });
};
UserEmail.isValidationPending = (uid, email) => __awaiter(void 0, void 0, void 0, function* () {
    const code = yield database_1.default.get(`confirm:byUid:${uid}`);
    if (email) {
        const confirmObj = yield database_1.default.getObject(`confirm:${code}`);
        return !!(confirmObj && email === confirmObj.email);
    }
    return !!code;
});
UserEmail.getValidationExpiry = (uid) => __awaiter(void 0, void 0, void 0, function* () {
    const pending = yield UserEmail.isValidationPending(uid);
    return pending ? database_1.default.pttl(`confirm:byUid:${uid}`) : null;
});
UserEmail.expireValidation = (uid) => __awaiter(void 0, void 0, void 0, function* () {
    const code = yield database_1.default.get(`confirm:byUid:${uid}`);
    yield database_1.default.deleteAll([
        `confirm:byUid:${uid}`,
        `confirm:${code}`,
    ]);
});
UserEmail.canSendValidation = (uid, email) => __awaiter(void 0, void 0, void 0, function* () {
    const pending = UserEmail.isValidationPending(uid, email);
    if (!pending) {
        return true;
    }
    const ttl = yield UserEmail.getValidationExpiry(uid);
    const max = meta_1.default.config.emailConfirmExpiry * 60 * 60 * 1000;
    const interval = meta_1.default.config.emailConfirmInterval * 60 * 1000;
    return ttl + interval < max;
});
UserEmail.sendValidationEmail = function (uid, options) {
    return __awaiter(this, void 0, void 0, function* () {
        /*
         * Options:
         * - email, overrides email retrieval
         * - force, sends email even if it is too soon to send another
         * - template, changes the template used for email sending
         */
        if (meta_1.default.config.sendValidationEmail !== 1) {
            winston_1.default.verbose(`[user/email] Validation email for uid ${uid} not sent due to config settings`);
            return;
        }
        options = options || {};
        // Fallback behaviour (email passed in as second argument)
        if (typeof options === 'string') {
            options = {
                email: options,
            };
        }
        const confirm_code = utils.generateUUID();
        const confirm_link = `${nconf_1.default.get('url')}/confirm/${confirm_code}`;
        const { emailConfirmInterval, emailConfirmExpiry } = meta_1.default.config;
        // If no email passed in (default), retrieve email from uid
        if (!options.email || !options.email.length) {
            options.email = yield user.getUserField(uid, 'email');
        }
        if (!options.email) {
            return;
        }
        if (!options.force && !(yield UserEmail.canSendValidation(uid, options.email))) {
            throw new Error(`[[error:confirm-email-already-sent, ${emailConfirmInterval}]]`);
        }
        const username = yield user.getUserField(uid, 'username');
        const data = yield plugins.hooks.fire('filter:user.verify', {
            uid,
            username,
            confirm_link,
            confirm_code: yield plugins.hooks.fire('filter:user.verify.code', confirm_code),
            email: options.email,
            subject: options.subject || '[[email:email.verify-your-email.subject]]',
            template: options.template || 'verify-email',
        });
        yield UserEmail.expireValidation(uid);
        yield database_1.default.set(`confirm:byUid:${uid}`, confirm_code);
        yield database_1.default.pexpire(`confirm:byUid:${uid}`, emailConfirmExpiry * 24 * 60 * 60 * 1000);
        yield database_1.default.setObject(`confirm:${confirm_code}`, {
            email: options.email.toLowerCase(),
            uid: uid,
        });
        yield database_1.default.pexpire(`confirm:${confirm_code}`, emailConfirmExpiry * 24 * 60 * 60 * 1000);
        winston_1.default.verbose(`[user/email] Validation email for uid ${uid} sent to ${options.email}`);
        events.log(Object.assign({ type: 'email-confirmation-sent', uid,
            confirm_code }, options));
        if (plugins.hooks.hasListeners('action:user.verify')) {
            plugins.hooks.fire('action:user.verify', { uid: uid, data: data });
        }
        else {
            yield emailer.send(data.template, uid, data);
        }
        return confirm_code;
    });
};
// confirm email by code sent by confirmation email
UserEmail.confirmByCode = function (code, sessionId) {
    return __awaiter(this, void 0, void 0, function* () {
        const confirmObj = yield database_1.default.getObject(`confirm:${code}`);
        if (!confirmObj || !confirmObj.uid || !confirmObj.email) {
            throw new Error('[[error:invalid-data]]');
        }
        // If another uid has the same email, remove it
        const oldUid = yield database_1.default.sortedSetScore('email:uid', confirmObj.email.toLowerCase());
        if (oldUid) {
            yield UserEmail.remove(oldUid, sessionId);
        }
        const oldEmail = yield user.getUserField(confirmObj.uid, 'email');
        if (oldEmail && confirmObj.email !== oldEmail) {
            yield UserEmail.remove(confirmObj.uid, sessionId);
        }
        else {
            yield user.auth.revokeAllSessions(confirmObj.uid, sessionId);
        }
        yield user.setUserField(confirmObj.uid, 'email', confirmObj.email);
        yield Promise.all([
            UserEmail.confirmByUid(confirmObj.uid),
            database_1.default.delete(`confirm:${code}`),
            events.log({ type: 'email-change', oldEmail, newEmail: confirmObj.email }),
        ]);
    });
};
// confirm uid's email via ACP
UserEmail.confirmByUid = function (uid) {
    return __awaiter(this, void 0, void 0, function* () {
        if (!(parseInt(uid, 10) > 0)) {
            throw new Error('[[error:invalid-uid]]');
        }
        const currentEmail = yield user.getUserField(uid, 'email');
        if (!currentEmail) {
            throw new Error('[[error:invalid-email]]');
        }
        yield Promise.all([
            database_1.default.sortedSetAddBulk([
                ['email:uid', uid, currentEmail.toLowerCase()],
                ['email:sorted', 0, `${currentEmail.toLowerCase()}:${uid}`],
                [`user:${uid}:emails`, Date.now(), `${currentEmail}:${Date.now()}`],
            ]),
            user.setUserField(uid, 'email:confirmed', 1),
            groups.join('verified-users', uid),
            groups.leave('unverified-users', uid),
            user.email.expireValidation(uid),
            user.reset.cleanByUid(uid),
        ]);
        yield plugins.hooks.fire('action:user.email.confirmed', { uid: uid, email: currentEmail });
    });
};
