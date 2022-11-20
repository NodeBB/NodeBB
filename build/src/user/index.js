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
const _ = require('lodash');
const groups = require('../groups');
const plugins = require('../plugins');
const database_1 = __importDefault(require("../database"));
const privileges = require('../privileges');
const categories = require('../categories');
const meta_1 = __importDefault(require("../meta"));
const utils = require('../utils');
const User = {};
User.email = require('./email');
User.notifications = require('./notifications');
User.reset = require('./reset');
User.digest = require('./digest');
User.interstitials = require('./interstitials');
require('./data').default(User);
require('./auth').default(User);
require('./bans').default(User);
require('./create').default(User);
require('./posts').default(User);
require('./topics').default(User);
require('./categories').default(User);
require('./follow').default(User);
require('./profile').default(User);
require('./admin').default(User);
require('./delete').default(User);
require('./settings').default(User);
require('./search').default(User);
require('./jobs').default(User);
require('./picture').default(User);
require('./approval').default(User);
require('./invite').default(User);
require('./password').default(User);
require('./info').default(User);
require('./online').default(User);
require('./blocks').default(User);
require('./uploads').default(User);
User.exists = function (uids) {
    return __awaiter(this, void 0, void 0, function* () {
        return yield (Array.isArray(uids) ?
            database_1.default.isSortedSetMembers('users:joindate', uids) :
            database_1.default.isSortedSetMember('users:joindate', uids));
    });
};
User.existsBySlug = function (userslug) {
    return __awaiter(this, void 0, void 0, function* () {
        const exists = yield User.getUidByUserslug(userslug);
        return !!exists;
    });
};
User.getUidsFromSet = function (set, start, stop) {
    return __awaiter(this, void 0, void 0, function* () {
        if (set === 'users:online') {
            const count = parseInt(stop, 10) === -1 ? stop : stop - start + 1;
            const now = Date.now();
            return yield database_1.default.getSortedSetRevRangeByScore(set, start, count, '+inf', now - (meta_1.default.config.onlineCutoff * 60000));
        }
        return yield database_1.default.getSortedSetRevRange(set, start, stop);
    });
};
User.getUsersFromSet = function (set, uid, start, stop) {
    return __awaiter(this, void 0, void 0, function* () {
        const uids = yield User.getUidsFromSet(set, start, stop);
        return yield User.getUsers(uids, uid);
    });
};
User.getUsersWithFields = function (uids, fields, uid) {
    return __awaiter(this, void 0, void 0, function* () {
        let results = yield plugins.hooks.fire('filter:users.addFields', { fields: fields });
        results.fields = _.uniq(results.fields);
        const userData = yield User.getUsersFields(uids, results.fields);
        results = yield plugins.hooks.fire('filter:userlist.get', { users: userData, uid: uid });
        return results.users;
    });
};
User.getUsers = function (uids, uid) {
    return __awaiter(this, void 0, void 0, function* () {
        const userData = yield User.getUsersWithFields(uids, [
            'uid', 'username', 'userslug', 'picture', 'status',
            'postcount', 'reputation', 'email:confirmed', 'lastonline',
            'flags', 'banned', 'banned:expire', 'joindate',
        ], uid);
        return User.hidePrivateData(userData, uid);
    });
};
User.getStatus = function (userData) {
    if (userData.uid <= 0) {
        return 'offline';
    }
    const isOnline = (Date.now() - userData.lastonline) < (meta_1.default.config.onlineCutoff * 60000);
    return isOnline ? (userData.status || 'online') : 'offline';
};
User.getUidByUsername = function (username) {
    return __awaiter(this, void 0, void 0, function* () {
        if (!username) {
            return 0;
        }
        return yield database_1.default.sortedSetScore('username:uid', username);
    });
};
User.getUidsByUsernames = function (usernames) {
    return __awaiter(this, void 0, void 0, function* () {
        return yield database_1.default.sortedSetScores('username:uid', usernames);
    });
};
User.getUidByUserslug = function (userslug) {
    return __awaiter(this, void 0, void 0, function* () {
        if (!userslug) {
            return 0;
        }
        return yield database_1.default.sortedSetScore('userslug:uid', userslug);
    });
};
User.getUsernamesByUids = function (uids) {
    return __awaiter(this, void 0, void 0, function* () {
        const users = yield User.getUsersFields(uids, ['username']);
        return users.map(user => user.username);
    });
};
User.getUsernameByUserslug = function (slug) {
    return __awaiter(this, void 0, void 0, function* () {
        const uid = yield User.getUidByUserslug(slug);
        return yield User.getUserField(uid, 'username');
    });
};
User.getUidByEmail = function (email) {
    return __awaiter(this, void 0, void 0, function* () {
        return yield database_1.default.sortedSetScore('email:uid', email.toLowerCase());
    });
};
User.getUidsByEmails = function (emails) {
    return __awaiter(this, void 0, void 0, function* () {
        emails = emails.map(email => email && email.toLowerCase());
        return yield database_1.default.sortedSetScores('email:uid', emails);
    });
};
User.getUsernameByEmail = function (email) {
    return __awaiter(this, void 0, void 0, function* () {
        const uid = yield database_1.default.sortedSetScore('email:uid', String(email).toLowerCase());
        return yield User.getUserField(uid, 'username');
    });
};
User.isModerator = function (uid, cid) {
    return __awaiter(this, void 0, void 0, function* () {
        return yield privileges.users.isModerator(uid, cid);
    });
};
User.isModeratorOfAnyCategory = function (uid) {
    return __awaiter(this, void 0, void 0, function* () {
        const cids = yield User.getModeratedCids(uid);
        return Array.isArray(cids) ? !!cids.length : false;
    });
};
User.isAdministrator = function (uid) {
    return __awaiter(this, void 0, void 0, function* () {
        return yield privileges.users.isAdministrator(uid);
    });
};
User.isGlobalModerator = function (uid) {
    return __awaiter(this, void 0, void 0, function* () {
        return yield privileges.users.isGlobalModerator(uid);
    });
};
User.getPrivileges = function (uid) {
    return __awaiter(this, void 0, void 0, function* () {
        return yield utils.promiseParallel({
            isAdmin: User.isAdministrator(uid),
            isGlobalModerator: User.isGlobalModerator(uid),
            isModeratorOfAnyCategory: User.isModeratorOfAnyCategory(uid),
        });
    });
};
User.isPrivileged = function (uid) {
    return __awaiter(this, void 0, void 0, function* () {
        if (!(parseInt(uid, 10) > 0)) {
            return false;
        }
        const results = yield User.getPrivileges(uid);
        return results ? (results.isAdmin || results.isGlobalModerator || results.isModeratorOfAnyCategory) : false;
    });
};
User.isAdminOrGlobalMod = function (uid) {
    return __awaiter(this, void 0, void 0, function* () {
        const [isAdmin, isGlobalMod] = yield Promise.all([
            User.isAdministrator(uid),
            User.isGlobalModerator(uid),
        ]);
        return isAdmin || isGlobalMod;
    });
};
User.isAdminOrSelf = function (callerUid, uid) {
    return __awaiter(this, void 0, void 0, function* () {
        yield isSelfOrMethod(callerUid, uid, User.isAdministrator);
    });
};
User.isAdminOrGlobalModOrSelf = function (callerUid, uid) {
    return __awaiter(this, void 0, void 0, function* () {
        yield isSelfOrMethod(callerUid, uid, User.isAdminOrGlobalMod);
    });
};
User.isPrivilegedOrSelf = function (callerUid, uid) {
    return __awaiter(this, void 0, void 0, function* () {
        yield isSelfOrMethod(callerUid, uid, User.isPrivileged);
    });
};
function isSelfOrMethod(callerUid, uid, method) {
    return __awaiter(this, void 0, void 0, function* () {
        if (parseInt(callerUid, 10) === parseInt(uid, 10)) {
            return;
        }
        const isPass = yield method(callerUid);
        if (!isPass) {
            throw new Error('[[error:no-privileges]]');
        }
    });
}
User.getAdminsandGlobalMods = function () {
    return __awaiter(this, void 0, void 0, function* () {
        const results = yield groups.getMembersOfGroups(['administrators', 'Global Moderators']);
        return yield User.getUsersData(_.union(...results));
    });
};
User.getAdminsandGlobalModsandModerators = function () {
    return __awaiter(this, void 0, void 0, function* () {
        const results = yield Promise.all([
            groups.getMembers('administrators', 0, -1),
            groups.getMembers('Global Moderators', 0, -1),
            User.getModeratorUids(),
        ]);
        return yield User.getUsersData(_.union(...results));
    });
};
User.getFirstAdminUid = function () {
    return __awaiter(this, void 0, void 0, function* () {
        return (yield database_1.default.getSortedSetRange('group:administrators:members', 0, 0))[0];
    });
};
User.getModeratorUids = function () {
    return __awaiter(this, void 0, void 0, function* () {
        const cids = yield categories.getAllCidsFromSet('categories:cid');
        const uids = yield categories.getModeratorUids(cids);
        return _.union(...uids);
    });
};
User.getModeratedCids = function (uid) {
    return __awaiter(this, void 0, void 0, function* () {
        if (parseInt(uid, 10) <= 0) {
            return [];
        }
        const cids = yield categories.getAllCidsFromSet('categories:cid');
        const isMods = yield User.isModerator(uid, cids);
        return cids.filter((cid, index) => cid && isMods[index]);
    });
};
User.addInterstitials = function (callback) {
    plugins.hooks.register('core', {
        hook: 'filter:register.interstitial',
        method: [
            User.interstitials.email,
            User.interstitials.gdpr,
            User.interstitials.tou, // Forum Terms of Use
        ],
    });
    callback();
};
require('../promisify').promisify(User);
exports.default = User;
