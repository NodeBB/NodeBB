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
const database_1 = __importDefault(require("../database"));
const user_1 = __importDefault(require("../user"));
const groups = require('../groups');
const meta_1 = __importDefault(require("../meta"));
const flags = require('../flags');
const privileges = require('../privileges');
const notifications = require('../notifications');
const plugins = require('../plugins');
const events = require('../events');
const translator = require('../translator');
const sockets = require('../socket.io');
const usersAPI = {};
usersAPI.create = function (caller, data) {
    return __awaiter(this, void 0, void 0, function* () {
        if (!data) {
            throw new Error('[[error:invalid-data]]');
        }
        const uid = yield user_1.default.create(data);
        return yield user_1.default.getUserData(uid);
    });
};
usersAPI.update = function (caller, data) {
    return __awaiter(this, void 0, void 0, function* () {
        if (!caller.uid) {
            throw new Error('[[error:invalid-uid]]');
        }
        if (!data || !data.uid) {
            throw new Error('[[error:invalid-data]]');
        }
        const oldUserData = yield user_1.default.getUserFields(data.uid, ['email', 'username']);
        if (!oldUserData || !oldUserData.username) {
            throw new Error('[[error:invalid-data]]');
        }
        const [isAdminOrGlobalMod, canEdit] = yield Promise.all([
            user_1.default.isAdminOrGlobalMod(caller.uid),
            privileges.users.canEdit(caller.uid, data.uid),
        ]);
        // Changing own email/username requires password confirmation
        if (data.hasOwnProperty('email') || data.hasOwnProperty('username')) {
            yield isPrivilegedOrSelfAndPasswordMatch(caller, data);
        }
        if (!canEdit) {
            throw new Error('[[error:no-privileges]]');
        }
        if (!isAdminOrGlobalMod && meta_1.default.config['username:disableEdit']) {
            data.username = oldUserData.username;
        }
        if (!isAdminOrGlobalMod && meta_1.default.config['email:disableEdit']) {
            data.email = oldUserData.email;
        }
        yield user_1.default.updateProfile(caller.uid, data);
        const userData = yield user_1.default.getUserData(data.uid);
        if (userData.username !== oldUserData.username) {
            yield events.log({
                type: 'username-change',
                uid: caller.uid,
                targetUid: data.uid,
                ip: caller.ip,
                oldUsername: oldUserData.username,
                newUsername: userData.username,
            });
        }
        return userData;
    });
};
usersAPI.delete = function (caller, { uid, password }) {
    return __awaiter(this, void 0, void 0, function* () {
        yield processDeletion({ uid: uid, method: 'delete', password, caller });
    });
};
usersAPI.deleteContent = function (caller, { uid, password }) {
    return __awaiter(this, void 0, void 0, function* () {
        yield processDeletion({ uid, method: 'deleteContent', password, caller });
    });
};
usersAPI.deleteAccount = function (caller, { uid, password }) {
    return __awaiter(this, void 0, void 0, function* () {
        yield processDeletion({ uid, method: 'deleteAccount', password, caller });
    });
};
usersAPI.deleteMany = function (caller, data) {
    return __awaiter(this, void 0, void 0, function* () {
        if (yield canDeleteUids(data.uids)) {
            yield Promise.all(data.uids.map(uid => processDeletion({ uid, method: 'delete', caller })));
        }
    });
};
usersAPI.updateSettings = function (caller, data) {
    return __awaiter(this, void 0, void 0, function* () {
        if (!caller.uid || !data || !data.settings) {
            throw new Error('[[error:invalid-data]]');
        }
        const canEdit = yield privileges.users.canEdit(caller.uid, data.uid);
        if (!canEdit) {
            throw new Error('[[error:no-privileges]]');
        }
        let defaults = yield user_1.default.getSettings(0);
        defaults = {
            postsPerPage: defaults.postsPerPage,
            topicsPerPage: defaults.topicsPerPage,
            userLang: defaults.userLang,
            acpLang: defaults.acpLang,
        };
        // load raw settings without parsing values to booleans
        const current = yield database_1.default.getObject(`user:${data.uid}:settings`);
        const payload = Object.assign(Object.assign(Object.assign({}, defaults), current), data.settings);
        delete payload.uid;
        return yield user_1.default.saveSettings(data.uid, payload);
    });
};
usersAPI.changePassword = function (caller, data) {
    return __awaiter(this, void 0, void 0, function* () {
        yield user_1.default.changePassword(caller.uid, Object.assign(data, { ip: caller.ip }));
        yield events.log({
            type: 'password-change',
            uid: caller.uid,
            targetUid: data.uid,
            ip: caller.ip,
        });
    });
};
usersAPI.follow = function (caller, data) {
    return __awaiter(this, void 0, void 0, function* () {
        yield user_1.default.follow(caller.uid, data.uid);
        plugins.hooks.fire('action:user.follow', {
            fromUid: caller.uid,
            toUid: data.uid,
        });
        const userData = yield user_1.default.getUserFields(caller.uid, ['username', 'userslug']);
        const { displayname } = userData;
        const notifObj = yield notifications.create({
            type: 'follow',
            bodyShort: `[[notifications:user_started_following_you, ${displayname}]]`,
            nid: `follow:${data.uid}:uid:${caller.uid}`,
            from: caller.uid,
            path: `/uid/${data.uid}/followers`,
            mergeId: 'notifications:user_started_following_you',
        });
        if (!notifObj) {
            return;
        }
        notifObj.user = userData;
        yield notifications.push(notifObj, [data.uid]);
    });
};
usersAPI.unfollow = function (caller, data) {
    return __awaiter(this, void 0, void 0, function* () {
        yield user_1.default.unfollow(caller.uid, data.uid);
        plugins.hooks.fire('action:user.unfollow', {
            fromUid: caller.uid,
            toUid: data.uid,
        });
    });
};
usersAPI.ban = function (caller, data) {
    return __awaiter(this, void 0, void 0, function* () {
        if (!(yield privileges.users.hasBanPrivilege(caller.uid))) {
            throw new Error('[[error:no-privileges]]');
        }
        else if (yield user_1.default.isAdministrator(data.uid)) {
            throw new Error('[[error:cant-ban-other-admins]]');
        }
        const banData = yield user_1.default.bans.ban(data.uid, data.until, data.reason);
        yield database_1.default.setObjectField(`uid:${data.uid}:ban:${banData.timestamp}`, 'fromUid', caller.uid);
        if (!data.reason) {
            data.reason = yield translator.translate('[[user:info.banned-no-reason]]');
        }
        sockets.in(`uid_${data.uid}`).emit('event:banned', {
            until: data.until,
            reason: validator.escape(String(data.reason || '')),
        });
        yield flags.resolveFlag('user', data.uid, caller.uid);
        yield flags.resolveUserPostFlags(data.uid, caller.uid);
        yield events.log({
            type: 'user-ban',
            uid: caller.uid,
            targetUid: data.uid,
            ip: caller.ip,
            reason: data.reason || undefined,
        });
        plugins.hooks.fire('action:user.banned', {
            callerUid: caller.uid,
            ip: caller.ip,
            uid: data.uid,
            until: data.until > 0 ? data.until : undefined,
            reason: data.reason || undefined,
        });
        const canLoginIfBanned = yield user_1.default.bans.canLoginIfBanned(data.uid);
        if (!canLoginIfBanned) {
            yield user_1.default.auth.revokeAllSessions(data.uid);
        }
    });
};
usersAPI.unban = function (caller, data) {
    return __awaiter(this, void 0, void 0, function* () {
        if (!(yield privileges.users.hasBanPrivilege(caller.uid))) {
            throw new Error('[[error:no-privileges]]');
        }
        yield user_1.default.bans.unban(data.uid);
        sockets.in(`uid_${data.uid}`).emit('event:unbanned');
        yield events.log({
            type: 'user-unban',
            uid: caller.uid,
            targetUid: data.uid,
            ip: caller.ip,
        });
        plugins.hooks.fire('action:user.unbanned', {
            callerUid: caller.uid,
            ip: caller.ip,
            uid: data.uid,
        });
    });
};
usersAPI.mute = function (caller, data) {
    return __awaiter(this, void 0, void 0, function* () {
        if (!(yield privileges.users.hasMutePrivilege(caller.uid))) {
            throw new Error('[[error:no-privileges]]');
        }
        else if (yield user_1.default.isAdministrator(data.uid)) {
            throw new Error('[[error:cant-mute-other-admins]]');
        }
        const reason = data.reason || '[[user:info.muted-no-reason]]';
        yield database_1.default.setObject(`user:${data.uid}`, {
            mutedUntil: data.until,
            mutedReason: reason,
        });
        const now = Date.now();
        const muteKey = `uid:${data.uid}:mute:${now}`;
        const muteData = {
            fromUid: caller.uid,
            uid: data.uid,
            timestamp: now,
            expire: data.until,
        };
        if (data.reason) {
            muteData.reason = reason;
        }
        yield database_1.default.sortedSetAdd(`uid:${data.uid}:mutes:timestamp`, now, muteKey);
        yield database_1.default.setObject(muteKey, muteData);
        yield events.log({
            type: 'user-mute',
            uid: caller.uid,
            targetUid: data.uid,
            ip: caller.ip,
            reason: data.reason || undefined,
        });
        plugins.hooks.fire('action:user.muted', {
            callerUid: caller.uid,
            ip: caller.ip,
            uid: data.uid,
            until: data.until > 0 ? data.until : undefined,
            reason: data.reason || undefined,
        });
    });
};
usersAPI.unmute = function (caller, data) {
    return __awaiter(this, void 0, void 0, function* () {
        if (!(yield privileges.users.hasMutePrivilege(caller.uid))) {
            throw new Error('[[error:no-privileges]]');
        }
        yield database_1.default.deleteObjectFields(`user:${data.uid}`, ['mutedUntil', 'mutedReason']);
        yield events.log({
            type: 'user-unmute',
            uid: caller.uid,
            targetUid: data.uid,
            ip: caller.ip,
        });
        plugins.hooks.fire('action:user.unmuted', {
            callerUid: caller.uid,
            ip: caller.ip,
            uid: data.uid,
        });
    });
};
function isPrivilegedOrSelfAndPasswordMatch(caller, data) {
    return __awaiter(this, void 0, void 0, function* () {
        const { uid } = caller;
        const isSelf = parseInt(uid, 10) === parseInt(data.uid, 10);
        const canEdit = yield privileges.users.canEdit(uid, data.uid);
        if (!canEdit) {
            throw new Error('[[error:no-privileges]]');
        }
        const [hasPassword, passwordMatch] = yield Promise.all([
            user_1.default.hasPassword(data.uid),
            data.password ? user_1.default.isPasswordCorrect(data.uid, data.password, caller.ip) : false,
        ]);
        if (isSelf && hasPassword && !passwordMatch) {
            throw new Error('[[error:invalid-password]]');
        }
    });
}
function processDeletion({ uid, method, password, caller }) {
    return __awaiter(this, void 0, void 0, function* () {
        const isTargetAdmin = yield user_1.default.isAdministrator(uid);
        const isSelf = parseInt(uid, 10) === parseInt(caller.uid, 10);
        const isAdmin = yield user_1.default.isAdministrator(caller.uid);
        if (isSelf && meta_1.default.config.allowAccountDelete !== 1) {
            throw new Error('[[error:account-deletion-disabled]]');
        }
        else if (!isSelf && !isAdmin) {
            throw new Error('[[error:no-privileges]]');
        }
        else if (isTargetAdmin) {
            throw new Error('[[error:cant-delete-admin]');
        }
        // Privilege checks -- only deleteAccount is available for non-admins
        const hasAdminPrivilege = yield privileges.admin.can('admin:users', caller.uid);
        if (!hasAdminPrivilege && ['delete', 'deleteContent'].includes(method)) {
            throw new Error('[[error:no-privileges]]');
        }
        // Self-deletions require a password
        const hasPassword = yield user_1.default.hasPassword(uid);
        if (isSelf && hasPassword) {
            const ok = yield user_1.default.isPasswordCorrect(uid, password, caller.ip);
            if (!ok) {
                throw new Error('[[error:invalid-password]]');
            }
        }
        yield flags.resolveFlag('user', uid, caller.uid);
        let userData;
        if (method === 'deleteAccount') {
            userData = yield user_1.default[method](uid);
        }
        else {
            userData = yield user_1.default[method](caller.uid, uid);
        }
        userData = userData || {};
        sockets.server.sockets.emit('event:user_status_change', { uid: caller.uid, status: 'offline' });
        plugins.hooks.fire('action:user.delete', {
            callerUid: caller.uid,
            uid: uid,
            ip: caller.ip,
            user: userData,
        });
        yield events.log({
            type: `user-${method}`,
            uid: caller.uid,
            targetUid: uid,
            ip: caller.ip,
            username: userData.username,
            email: userData.email,
        });
    });
}
function canDeleteUids(uids) {
    return __awaiter(this, void 0, void 0, function* () {
        if (!Array.isArray(uids)) {
            throw new Error('[[error:invalid-data]]');
        }
        const isMembers = yield groups.isMembers(uids, 'administrators');
        if (isMembers.includes(true)) {
            throw new Error('[[error:cant-delete-other-admins]]');
        }
        return true;
    });
}
usersAPI.search = function (caller, data) {
    return __awaiter(this, void 0, void 0, function* () {
        if (!data) {
            throw new Error('[[error:invalid-data]]');
        }
        const [allowed, isPrivileged] = yield Promise.all([
            privileges.global.can('search:users', caller.uid),
            user_1.default.isPrivileged(caller.uid),
        ]);
        let filters = data.filters || [];
        filters = Array.isArray(filters) ? filters : [filters];
        if (!allowed ||
            ((data.searchBy === 'ip' ||
                data.searchBy === 'email' ||
                filters.includes('banned') ||
                filters.includes('flagged')) && !isPrivileged)) {
            throw new Error('[[error:no-privileges]]');
        }
        return yield user_1.default.search({
            query: data.query,
            searchBy: data.searchBy || 'username',
            page: data.page || 1,
            sortBy: data.sortBy || 'lastonline',
            filters: filters,
        });
    });
};
usersAPI.changePicture = (caller, data) => __awaiter(void 0, void 0, void 0, function* () {
    if (!data) {
        throw new Error('[[error:invalid-data]]');
    }
    const { type, url } = data;
    let picture = '';
    yield user_1.default.checkMinReputation(caller.uid, data.uid, 'min:rep:profile-picture');
    const canEdit = yield privileges.users.canEdit(caller.uid, data.uid);
    if (!canEdit) {
        throw new Error('[[error:no-privileges]]');
    }
    if (type === 'default') {
        picture = '';
    }
    else if (type === 'uploaded') {
        picture = yield user_1.default.getUserField(data.uid, 'uploadedpicture');
    }
    else if (type === 'external' && url) {
        picture = validator.escape(url);
    }
    else {
        const returnData = yield plugins.hooks.fire('filter:user.getPicture', {
            uid: caller.uid,
            type: type,
            picture: undefined,
        });
        picture = returnData && returnData.picture;
    }
    const validBackgrounds = yield user_1.default.getIconBackgrounds(caller.uid);
    if (!validBackgrounds.includes(data.bgColor)) {
        data.bgColor = validBackgrounds[0];
    }
    yield user_1.default.updateProfile(caller.uid, {
        uid: data.uid,
        picture: picture,
        'icon:bgColor': data.bgColor,
    }, ['picture', 'icon:bgColor']);
});
usersAPI.generateExport = (caller, { uid, type }) => __awaiter(void 0, void 0, void 0, function* () {
    const count = yield database_1.default.incrObjectField('locks', `export:${uid}${type}`);
    if (count > 1) {
        throw new Error('[[error:already-exporting]]');
    }
    const child = require('child_process').fork(`./src/user/jobs/export-${type}.js`, [], {
        env: process.env,
    });
    child.send({ uid });
    child.on('error', (err) => __awaiter(void 0, void 0, void 0, function* () {
        winston_1.default.error(err.stack);
        yield database_1.default.deleteObjectField('locks', `export:${uid}${type}`);
    }));
    child.on('exit', () => __awaiter(void 0, void 0, void 0, function* () {
        yield database_1.default.deleteObjectField('locks', `export:${uid}${type}`);
        const { displayname } = yield user_1.default.getUserFields(uid, ['username']);
        const n = yield notifications.create({
            bodyShort: `[[notifications:${type}-exported, ${displayname}]]`,
            path: `/api/v3/users/${uid}/exports/${type}`,
            nid: `${type}:export:${uid}`,
            from: uid,
        });
        yield notifications.push(n, [caller.uid]);
        yield events.log({
            type: `export:${type}`,
            uid: caller.uid,
            targetUid: uid,
            ip: caller.ip,
        });
    }));
});
exports.default = usersAPI;
