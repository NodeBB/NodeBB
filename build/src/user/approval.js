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
const validator = require('validator');
const winston_1 = __importDefault(require("winston"));
const cronJob = require('cron').CronJob;
const database_1 = __importDefault(require("../database"));
const meta_1 = __importDefault(require("../meta"));
const emailer = require('../emailer');
const notifications = require('../notifications');
const groups = require('../groups');
const utils = require('../utils');
const slugify = require('../slugify');
const plugins = require('../plugins');
function default_1(User) {
    new cronJob('0 * * * *', (() => {
        User.autoApprove();
    }), null, true);
    User.addToApprovalQueue = function (userData) {
        return __awaiter(this, void 0, void 0, function* () {
            userData.username = userData.username.trim();
            userData.userslug = slugify(userData.username);
            yield canQueue(userData);
            const hashedPassword = yield User.hashPassword(userData.password);
            const data = {
                username: userData.username,
                email: userData.email,
                ip: userData.ip,
                hashedPassword: hashedPassword,
            };
            const results = yield plugins.hooks.fire('filter:user.addToApprovalQueue', { data: data, userData: userData });
            yield database_1.default.setObject(`registration:queue:name:${userData.username}`, results.data);
            yield database_1.default.sortedSetAdd('registration:queue', Date.now(), userData.username);
            yield sendNotificationToAdmins(userData.username);
        });
    };
    function canQueue(userData) {
        return __awaiter(this, void 0, void 0, function* () {
            yield User.isDataValid(userData);
            const usernames = yield database_1.default.getSortedSetRange('registration:queue', 0, -1);
            if (usernames.includes(userData.username)) {
                throw new Error('[[error:username-taken]]');
            }
            const keys = usernames.filter(Boolean).map((username) => `registration:queue:name:${username}`);
            const data = yield database_1.default.getObjectsFields(keys, ['email']);
            const emails = data.map((data) => data && data.email).filter(Boolean);
            if (userData.email && emails.includes(userData.email)) {
                throw new Error('[[error:email-taken]]');
            }
        });
    }
    function sendNotificationToAdmins(username) {
        return __awaiter(this, void 0, void 0, function* () {
            const notifObj = yield notifications.create({
                type: 'new-register',
                bodyShort: `[[notifications:new_register, ${username}]]`,
                nid: `new_register:${username}`,
                path: '/admin/manage/registration',
                mergeId: 'new_register',
            });
            yield notifications.pushGroup(notifObj, 'administrators');
        });
    }
    User.acceptRegistration = function (username) {
        return __awaiter(this, void 0, void 0, function* () {
            const userData = yield database_1.default.getObject(`registration:queue:name:${username}`);
            if (!userData) {
                throw new Error('[[error:invalid-data]]');
            }
            const creation_time = yield database_1.default.sortedSetScore('registration:queue', username);
            const uid = yield User.create(userData);
            yield User.setUserFields(uid, {
                password: userData.hashedPassword,
                'password:shaWrapped': 1,
            });
            yield removeFromQueue(username);
            yield markNotificationRead(username);
            yield plugins.hooks.fire('filter:register.complete', { uid: uid });
            yield emailer.send('registration_accepted', uid, {
                username: username,
                subject: `[[email:welcome-to, ${meta_1.default.config.title || meta_1.default.config.browserTitle || 'NodeBB'}]]`,
                template: 'registration_accepted',
                uid: uid,
            }).catch((err) => winston_1.default.error(`[emailer.send] ${err.stack}`));
            const total = yield database_1.default.incrObjectFieldBy('registration:queue:approval:times', 'totalTime', Math.floor((Date.now() - creation_time) / 60000));
            const counter = yield database_1.default.incrObjectField('registration:queue:approval:times', 'counter');
            yield database_1.default.setObjectField('registration:queue:approval:times', 'average', total / counter);
            return uid;
        });
    };
    function markNotificationRead(username) {
        return __awaiter(this, void 0, void 0, function* () {
            const nid = `new_register:${username}`;
            const uids = yield groups.getMembers('administrators', 0, -1);
            const promises = uids.map((uid) => notifications.markRead(nid, uid));
            yield Promise.all(promises);
        });
    }
    User.rejectRegistration = function (username) {
        return __awaiter(this, void 0, void 0, function* () {
            yield removeFromQueue(username);
            yield markNotificationRead(username);
        });
    };
    function removeFromQueue(username) {
        return __awaiter(this, void 0, void 0, function* () {
            yield Promise.all([
                database_1.default.sortedSetRemove('registration:queue', username),
                database_1.default.delete(`registration:queue:name:${username}`),
            ]);
        });
    }
    User.shouldQueueUser = function (ip) {
        return __awaiter(this, void 0, void 0, function* () {
            const { registrationApprovalType } = meta_1.default.config;
            if (registrationApprovalType === 'admin-approval') {
                return true;
            }
            else if (registrationApprovalType === 'admin-approval-ip') {
                const count = yield database_1.default.sortedSetCard(`ip:${ip}:uid`);
                return !!count;
            }
            return false;
        });
    };
    User.getRegistrationQueue = function (start, stop) {
        return __awaiter(this, void 0, void 0, function* () {
            const data = yield database_1.default.getSortedSetRevRangeWithScores('registration:queue', start, stop);
            const keys = data.filter(Boolean).map((user) => `registration:queue:name:${user.value}`);
            let users = yield database_1.default.getObjects(keys);
            users = users.filter(Boolean).map((user, index) => {
                user.timestampISO = utils.toISOString(data[index].score);
                user.email = validator.escape(String(user.email));
                user.usernameEscaped = validator.escape(String(user.username));
                delete user.hashedPassword;
                return user;
            });
            yield Promise.all(users.map((user) => __awaiter(this, void 0, void 0, function* () {
                // temporary: see http://www.stopforumspam.com/forum/viewtopic.php?id=6392
                // need to keep this for getIPMatchedUsers
                user.ip = user.ip.replace('::ffff:', '');
                yield getIPMatchedUsers(user);
                user.customActions = user.customActions || [];
                /*
                    // then spam prevention plugins, using the "filter:user.getRegistrationQueue" hook can be like:
                    user.customActions.push({
                        title: '[[spam-be-gone:report-user]]',
                        id: 'report-spam-user-' + user.username,
                        class: 'btn-warning report-spam-user',
                        icon: 'fa-flag'
                    });
                 */
            })));
            const results = yield plugins.hooks.fire('filter:user.getRegistrationQueue', { users: users });
            return results.users;
        });
    };
    function getIPMatchedUsers(user) {
        return __awaiter(this, void 0, void 0, function* () {
            const uids = yield User.getUidsFromSet(`ip:${user.ip}:uid`, 0, -1);
            user.ipMatch = yield User.getUsersFields(uids, ['uid', 'username', 'picture']);
        });
    }
    User.autoApprove = function () {
        return __awaiter(this, void 0, void 0, function* () {
            if (meta_1.default.config.autoApproveTime <= 0) {
                return;
            }
            const users = yield database_1.default.getSortedSetRevRangeWithScores('registration:queue', 0, -1);
            const now = Date.now();
            for (const user of users.filter((user) => now - user.score >= meta_1.default.config.autoApproveTime * 3600000)) {
                // eslint-disable-next-line no-await-in-loop
                yield User.acceptRegistration(user.value);
            }
        });
    };
}
exports.default = default_1;
;
