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
const nconf_1 = __importDefault(require("nconf"));
const _ = require('lodash');
const database_1 = __importDefault(require("../database"));
const meta_1 = __importDefault(require("../meta"));
const plugins = require('../plugins');
const utils = require('../utils');
const relative_path = nconf_1.default.get('relative_path');
const intFields = [
    'uid', 'postcount', 'topiccount', 'reputation', 'profileviews',
    'banned', 'banned:expire', 'email:confirmed', 'joindate', 'lastonline',
    'lastqueuetime', 'lastposttime', 'followingCount', 'followerCount',
    'blocksCount', 'passwordExpiry', 'mutedUntil',
];
function default_1(User) {
    const fieldWhitelist = [
        'uid', 'username', 'userslug', 'email', 'email:confirmed', 'joindate',
        'lastonline', 'picture', 'icon:bgColor', 'fullname', 'location', 'birthday', 'website',
        'aboutme', 'signature', 'uploadedpicture', 'profileviews', 'reputation',
        'postcount', 'topiccount', 'lastposttime', 'banned', 'banned:expire',
        'status', 'flags', 'followerCount', 'followingCount', 'cover:url',
        'cover:position', 'groupTitle', 'mutedUntil', 'mutedReason',
    ];
    User.guestData = {
        uid: 0,
        username: '[[global:guest]]',
        displayname: '[[global:guest]]',
        userslug: '',
        fullname: '[[global:guest]]',
        email: '',
        'icon:text': '?',
        'icon:bgColor': '#aaa',
        groupTitle: '',
        groupTitleArray: [],
        status: 'offline',
        reputation: 0,
        'email:confirmed': 0,
    };
    User.getUsersFields = function (uids, fields) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!Array.isArray(uids) || !uids.length) {
                return [];
            }
            uids = uids.map(uid => (isNaN(uid) ? 0 : parseInt(uid, 10)));
            const fieldsToRemove = [];
            fields = fields.slice();
            ensureRequiredFields(fields, fieldsToRemove);
            const uniqueUids = _.uniq(uids).filter(uid => uid > 0);
            const results = yield plugins.hooks.fire('filter:user.whitelistFields', {
                uids: uids,
                whitelist: fieldWhitelist.slice(),
            });
            if (!fields.length) {
                fields = results.whitelist;
            }
            else {
                // Never allow password retrieval via this method
                fields = fields.filter(value => value !== 'password');
            }
            const users = yield database_1.default.getObjectsFields(uniqueUids.map(uid => `user:${uid}`), fields);
            const result = yield plugins.hooks.fire('filter:user.getFields', {
                uids: uniqueUids,
                users: users,
                fields: fields,
            });
            result.users.forEach((user, index) => {
                if (uniqueUids[index] > 0 && !user.uid) {
                    user.oldUid = uniqueUids[index];
                }
            });
            yield modifyUserData(result.users, fields, fieldsToRemove);
            return uidsToUsers(uids, uniqueUids, result.users);
        });
    };
    function ensureRequiredFields(fields, fieldsToRemove) {
        function addField(field) {
            if (!fields.includes(field)) {
                fields.push(field);
                fieldsToRemove.push(field);
            }
        }
        if (fields.length && !fields.includes('uid')) {
            fields.push('uid');
        }
        if (fields.includes('picture')) {
            addField('uploadedpicture');
        }
        if (fields.includes('status')) {
            addField('lastonline');
        }
        if (fields.includes('banned') && !fields.includes('banned:expire')) {
            addField('banned:expire');
        }
        if (fields.includes('username') && !fields.includes('fullname')) {
            addField('fullname');
        }
    }
    function uidsToUsers(uids, uniqueUids, usersData) {
        const uidToUser = _.zipObject(uniqueUids, usersData);
        const users = uids.map((uid) => {
            const user = uidToUser[uid] || Object.assign({}, User.guestData);
            if (!parseInt(user.uid, 10)) {
                user.username = (user.hasOwnProperty('oldUid') && parseInt(user.oldUid, 10)) ? '[[global:former_user]]' : '[[global:guest]]';
                user.displayname = user.username;
            }
            return user;
        });
        return users;
    }
    User.getUserField = function (uid, field) {
        return __awaiter(this, void 0, void 0, function* () {
            const user = yield User.getUserFields(uid, [field]);
            return user ? user[field] : null;
        });
    };
    User.getUserFields = function (uid, fields) {
        return __awaiter(this, void 0, void 0, function* () {
            const users = yield User.getUsersFields([uid], fields);
            return users ? users[0] : null;
        });
    };
    User.getUserData = function (uid) {
        return __awaiter(this, void 0, void 0, function* () {
            const users = yield User.getUsersData([uid]);
            return users ? users[0] : null;
        });
    };
    User.getUsersData = function (uids) {
        return __awaiter(this, void 0, void 0, function* () {
            return yield User.getUsersFields(uids, []);
        });
    };
    User.hidePrivateData = function (users, callerUID) {
        return __awaiter(this, void 0, void 0, function* () {
            let single = false;
            if (!Array.isArray(users)) {
                users = [users];
                single = true;
            }
            const [userSettings, isAdmin, isGlobalModerator] = yield Promise.all([
                User.getMultipleUserSettings(users.map(user => user.uid)),
                User.isAdministrator(callerUID),
                User.isGlobalModerator(callerUID),
            ]);
            users = yield Promise.all(users.map((userData, idx) => __awaiter(this, void 0, void 0, function* () {
                const _userData = Object.assign({}, userData);
                const isSelf = parseInt(callerUID, 10) === parseInt(_userData.uid, 10);
                const privilegedOrSelf = isAdmin || isGlobalModerator || isSelf;
                if (!privilegedOrSelf && (!userSettings[idx].showemail || meta_1.default.config.hideEmail)) {
                    _userData.email = '';
                }
                if (!privilegedOrSelf && (!userSettings[idx].showfullname || meta_1.default.config.hideFullname)) {
                    _userData.fullname = '';
                }
                return _userData;
            })));
            return single ? users.pop() : users;
        });
    };
    function modifyUserData(users, requestedFields, fieldsToRemove) {
        return __awaiter(this, void 0, void 0, function* () {
            let uidToSettings = {};
            if (meta_1.default.config.showFullnameAsDisplayName) {
                const uids = users.map(user => user.uid);
                uidToSettings = _.zipObject(uids, yield database_1.default.getObjectsFields(uids.map(uid => `user:${uid}:settings`), ['showfullname']));
            }
            yield Promise.all(users.map((user) => __awaiter(this, void 0, void 0, function* () {
                if (!user) {
                    return;
                }
                database_1.default.parseIntFields(user, intFields, requestedFields);
                if (user.hasOwnProperty('username')) {
                    parseDisplayName(user, uidToSettings);
                    user.username = validator.escape(user.username ? user.username.toString() : '');
                }
                if (user.hasOwnProperty('email')) {
                    user.email = validator.escape(user.email ? user.email.toString() : '');
                }
                if (!parseInt(user.uid, 10)) {
                    for (const [key, value] of Object.entries(User.guestData)) {
                        user[key] = value;
                    }
                    user.picture = User.getDefaultAvatar();
                }
                if (user.hasOwnProperty('groupTitle')) {
                    parseGroupTitle(user);
                }
                if (user.picture && user.picture === user.uploadedpicture) {
                    user.uploadedpicture = user.picture.startsWith('http') ? user.picture : relative_path + user.picture;
                    user.picture = user.uploadedpicture;
                }
                else if (user.uploadedpicture) {
                    user.uploadedpicture = user.uploadedpicture.startsWith('http') ? user.uploadedpicture : relative_path + user.uploadedpicture;
                }
                if (meta_1.default.config.defaultAvatar && !user.picture) {
                    user.picture = User.getDefaultAvatar();
                }
                if (user.hasOwnProperty('status') && user.hasOwnProperty('lastonline')) {
                    user.status = User.getStatus(user);
                }
                for (let i = 0; i < fieldsToRemove.length; i += 1) {
                    user[fieldsToRemove[i]] = undefined;
                }
                // User Icons
                if (requestedFields.includes('picture') && user.username && parseInt(user.uid, 10) && !meta_1.default.config.defaultAvatar) {
                    const iconBackgrounds = yield User.getIconBackgrounds(user.uid);
                    let bgColor = yield User.getUserField(user.uid, 'icon:bgColor');
                    if (!iconBackgrounds.includes(bgColor)) {
                        bgColor = Array.prototype.reduce.call(user.username, (cur, next) => cur + next.charCodeAt(), 0);
                        bgColor = iconBackgrounds[bgColor % iconBackgrounds.length];
                    }
                    user['icon:text'] = (user.username[0] || '').toUpperCase();
                    user['icon:bgColor'] = bgColor;
                }
                if (user.hasOwnProperty('joindate')) {
                    user.joindateISO = utils.toISOString(user.joindate);
                }
                if (user.hasOwnProperty('lastonline')) {
                    user.lastonlineISO = utils.toISOString(user.lastonline) || user.joindateISO;
                }
                if (user.hasOwnProperty('banned') || user.hasOwnProperty('banned:expire')) {
                    const result = yield User.bans.calcExpiredFromUserData(user);
                    user.banned = result.banned;
                    const unban = result.banned && result.banExpired;
                    user.banned_until = unban ? 0 : user['banned:expire'];
                    user.banned_until_readable = user.banned_until && !unban ? utils.toISOString(user.banned_until) : 'Not Banned';
                    if (unban) {
                        yield User.bans.unban(user.uid);
                        user.banned = false;
                    }
                }
                if (user.hasOwnProperty('mutedUntil')) {
                    user.muted = user.mutedUntil > Date.now();
                }
            })));
            return yield plugins.hooks.fire('filter:users.get', users);
        });
    }
    function parseDisplayName(user, uidToSettings) {
        let showfullname = parseInt(meta_1.default.config.showfullname, 10) === 1;
        if (uidToSettings[user.uid]) {
            if (parseInt(uidToSettings[user.uid].showfullname, 10) === 0) {
                showfullname = false;
            }
            else if (parseInt(uidToSettings[user.uid].showfullname, 10) === 1) {
                showfullname = true;
            }
        }
        user.displayname = validator.escape(String(meta_1.default.config.showFullnameAsDisplayName && showfullname && user.fullname ?
            user.fullname :
            user.username));
    }
    function parseGroupTitle(user) {
        try {
            user.groupTitleArray = JSON.parse(user.groupTitle);
        }
        catch (err) {
            if (user.groupTitle) {
                user.groupTitleArray = [user.groupTitle];
            }
            else {
                user.groupTitle = '';
                user.groupTitleArray = [];
            }
        }
        if (!Array.isArray(user.groupTitleArray)) {
            if (user.groupTitleArray) {
                user.groupTitleArray = [user.groupTitleArray];
            }
            else {
                user.groupTitleArray = [];
            }
        }
        if (!meta_1.default.config.allowMultipleBadges && user.groupTitleArray.length) {
            user.groupTitleArray = [user.groupTitleArray[0]];
        }
    }
    User.getIconBackgrounds = (uid = 0) => __awaiter(this, void 0, void 0, function* () {
        let iconBackgrounds = [
            '#f44336', '#e91e63', '#9c27b0', '#673ab7', '#3f51b5', '#2196f3',
            '#009688', '#1b5e20', '#33691e', '#827717', '#e65100', '#ff5722',
            '#795548', '#607d8b',
        ];
        ({ iconBackgrounds } = yield plugins.hooks.fire('filter:user.iconBackgrounds', { uid, iconBackgrounds }));
        return iconBackgrounds;
    });
    User.getDefaultAvatar = function () {
        if (!meta_1.default.config.defaultAvatar) {
            return '';
        }
        return meta_1.default.config.defaultAvatar.startsWith('http') ? meta_1.default.config.defaultAvatar : relative_path + meta_1.default.config.defaultAvatar;
    };
    User.setUserField = function (uid, field, value) {
        return __awaiter(this, void 0, void 0, function* () {
            yield User.setUserFields(uid, { [field]: value });
        });
    };
    User.setUserFields = function (uid, data) {
        return __awaiter(this, void 0, void 0, function* () {
            yield database_1.default.setObject(`user:${uid}`, data);
            for (const [field, value] of Object.entries(data)) {
                plugins.hooks.fire('action:user.set', { uid, field, value, type: 'set' });
            }
        });
    };
    User.incrementUserFieldBy = function (uid, field, value) {
        return __awaiter(this, void 0, void 0, function* () {
            return yield incrDecrUserFieldBy(uid, field, value, 'increment');
        });
    };
    User.decrementUserFieldBy = function (uid, field, value) {
        return __awaiter(this, void 0, void 0, function* () {
            return yield incrDecrUserFieldBy(uid, field, -value, 'decrement');
        });
    };
    function incrDecrUserFieldBy(uid, field, value, type) {
        return __awaiter(this, void 0, void 0, function* () {
            const newValue = yield database_1.default.incrObjectFieldBy(`user:${uid}`, field, value);
            plugins.hooks.fire('action:user.set', { uid: uid, field: field, value: newValue, type: type });
            return newValue;
        });
    }
}
exports.default = default_1;
;
