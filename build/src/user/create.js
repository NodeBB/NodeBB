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
const zxcvbn = require('zxcvbn');
const winston_1 = __importDefault(require("winston"));
const database_1 = __importDefault(require("../database"));
const utils = require('../utils');
const slugify = require('../slugify');
const plugins = require('../plugins');
const groups = require('../groups');
const meta_1 = __importDefault(require("../meta"));
const analytics = require('../analytics');
function default_1(User) {
    User.create = function (data) {
        return __awaiter(this, void 0, void 0, function* () {
            data.username = data.username.trim();
            data.userslug = slugify(data.username);
            if (data.email !== undefined) {
                data.email = String(data.email).trim();
            }
            yield User.isDataValid(data);
            yield lock(data.username, '[[error:username-taken]]');
            if (data.email && data.email !== data.username) {
                yield lock(data.email, '[[error:email-taken]]');
            }
            try {
                return yield create(data);
            }
            finally {
                yield database_1.default.deleteObjectFields('locks', [data.username, data.email]);
            }
        });
    };
    function lock(value, error) {
        return __awaiter(this, void 0, void 0, function* () {
            const count = yield database_1.default.incrObjectField('locks', value);
            if (count > 1) {
                throw new Error(error);
            }
        });
    }
    function create(data) {
        return __awaiter(this, void 0, void 0, function* () {
            const timestamp = data.timestamp || Date.now();
            let userData = {
                username: data.username,
                userslug: data.userslug,
                joindate: timestamp,
                lastonline: timestamp,
                status: 'online',
            };
            ['picture', 'fullname', 'location', 'birthday'].forEach((field) => {
                if (data[field]) {
                    userData[field] = data[field];
                }
            });
            if (data.gdpr_consent === true) {
                userData.gdpr_consent = 1;
            }
            if (data.acceptTos === true) {
                userData.acceptTos = 1;
            }
            const renamedUsername = yield User.uniqueUsername(userData);
            const userNameChanged = !!renamedUsername;
            if (userNameChanged) {
                userData.username = renamedUsername;
                userData.userslug = slugify(renamedUsername);
            }
            const results = yield plugins.hooks.fire('filter:user.create', { user: userData, data: data });
            userData = results.user;
            const uid = yield database_1.default.incrObjectField('global', 'nextUid');
            const isFirstUser = uid === 1;
            userData.uid = uid;
            yield database_1.default.setObject(`user:${uid}`, userData);
            const bulkAdd = [
                ['username:uid', userData.uid, userData.username],
                [`user:${userData.uid}:usernames`, timestamp, `${userData.username}:${timestamp}`],
                ['username:sorted', 0, `${userData.username.toLowerCase()}:${userData.uid}`],
                ['userslug:uid', userData.uid, userData.userslug],
                ['users:joindate', timestamp, userData.uid],
                ['users:online', timestamp, userData.uid],
                ['users:postcount', 0, userData.uid],
                ['users:reputation', 0, userData.uid],
            ];
            if (userData.fullname) {
                bulkAdd.push(['fullname:sorted', 0, `${userData.fullname.toLowerCase()}:${userData.uid}`]);
            }
            yield Promise.all([
                database_1.default.incrObjectField('global', 'userCount'),
                analytics.increment('registrations'),
                database_1.default.sortedSetAddBulk(bulkAdd),
                groups.join(['registered-users', 'unverified-users'], userData.uid),
                User.notifications.sendWelcomeNotification(userData.uid),
                storePassword(userData.uid, data.password),
                User.updateDigestSetting(userData.uid, meta_1.default.config.dailyDigestFreq),
            ]);
            if (data.email && isFirstUser) {
                yield User.setUserField(uid, 'email', data.email);
                yield User.email.confirmByUid(userData.uid);
            }
            if (data.email && userData.uid > 1) {
                yield User.email.sendValidationEmail(userData.uid, {
                    email: data.email,
                    template: 'welcome',
                    subject: `[[email:welcome-to, ${meta_1.default.config.title || meta_1.default.config.browserTitle || 'NodeBB'}]]`,
                }).catch(err => winston_1.default.error(`[user.create] Validation email failed to send\n[emailer.send] ${err.stack}`));
            }
            if (userNameChanged) {
                yield User.notifications.sendNameChangeNotification(userData.uid, userData.username);
            }
            plugins.hooks.fire('action:user.create', { user: userData, data: data });
            return userData.uid;
        });
    }
    function storePassword(uid, password) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!password) {
                return;
            }
            const hash = yield User.hashPassword(password);
            yield Promise.all([
                User.setUserFields(uid, {
                    password: hash,
                    'password:shaWrapped': 1,
                }),
                User.reset.updateExpiry(uid),
            ]);
        });
    }
    User.isDataValid = function (userData) {
        return __awaiter(this, void 0, void 0, function* () {
            if (userData.email && !utils.isEmailValid(userData.email)) {
                throw new Error('[[error:invalid-email]]');
            }
            if (!utils.isUserNameValid(userData.username) || !userData.userslug) {
                throw new Error(`[[error:invalid-username, ${userData.username}]]`);
            }
            if (userData.password) {
                User.isPasswordValid(userData.password);
            }
            if (userData.email) {
                const available = yield User.email.available(userData.email);
                if (!available) {
                    throw new Error('[[error:email-taken]]');
                }
            }
        });
    };
    User.isPasswordValid = function (password, minStrength) {
        minStrength = (minStrength || minStrength === 0) ? minStrength : meta_1.default.config.minimumPasswordStrength;
        // Sanity checks: Checks if defined and is string
        if (!password || !utils.isPasswordValid(password)) {
            throw new Error('[[error:invalid-password]]');
        }
        if (password.length < meta_1.default.config.minimumPasswordLength) {
            throw new Error('[[reset_password:password_too_short]]');
        }
        if (password.length > 512) {
            throw new Error('[[error:password-too-long]]');
        }
        const strength = zxcvbn(password);
        if (strength.score < minStrength) {
            throw new Error('[[user:weak_password]]');
        }
    };
    User.uniqueUsername = function (userData) {
        return __awaiter(this, void 0, void 0, function* () {
            let numTries = 0;
            let { username } = userData;
            while (true) {
                /* eslint-disable no-await-in-loop */
                const exists = yield meta_1.default.userOrGroupExists(username);
                if (!exists) {
                    return numTries ? username : null;
                }
                username = `${userData.username} ${numTries.toString(32)}`;
                numTries += 1;
            }
        });
    };
}
exports.default = default_1;
;
