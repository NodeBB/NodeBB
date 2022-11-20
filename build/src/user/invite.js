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
const async = require('async');
const nconf_1 = __importDefault(require("nconf"));
const validator = require('validator');
const database_1 = __importDefault(require("../database"));
const meta_1 = __importDefault(require("../meta"));
const emailer = require('../emailer');
const groups = require('../groups');
const translator = require('../translator');
const utils = require('../utils');
const plugins = require('../plugins');
function default_1(User) {
    User.getInvites = function (uid) {
        return __awaiter(this, void 0, void 0, function* () {
            const emails = yield database_1.default.getSetMembers(`invitation:uid:${uid}`);
            return emails.map(email => validator.escape(String(email)));
        });
    };
    User.getInvitesNumber = function (uid) {
        return __awaiter(this, void 0, void 0, function* () {
            return yield database_1.default.setCount(`invitation:uid:${uid}`);
        });
    };
    User.getInvitingUsers = function () {
        return __awaiter(this, void 0, void 0, function* () {
            return yield database_1.default.getSetMembers('invitation:uids');
        });
    };
    User.getAllInvites = function () {
        return __awaiter(this, void 0, void 0, function* () {
            const uids = yield User.getInvitingUsers();
            const invitations = yield async.map(uids, User.getInvites);
            return invitations.map((invites, index) => ({
                uid: uids[index],
                invitations: invites,
            }));
        });
    };
    User.sendInvitationEmail = function (uid, email, groupsToJoin) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!uid) {
                throw new Error('[[error:invalid-uid]]');
            }
            const email_exists = yield User.getUidByEmail(email);
            if (email_exists) {
                // Silently drop the invitation if the invited email already exists locally
                return true;
            }
            const invitation_exists = yield database_1.default.exists(`invitation:uid:${uid}:invited:${email}`);
            if (invitation_exists) {
                throw new Error('[[error:email-invited]]');
            }
            const data = yield prepareInvitation(uid, email, groupsToJoin);
            yield emailer.sendToEmail('invitation', email, meta_1.default.config.defaultLang, data);
            plugins.hooks.fire('action:user.invite', { uid, email, groupsToJoin });
        });
    };
    User.verifyInvitation = function (query) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!query.token) {
                if (meta_1.default.config.registrationType.startsWith('admin-')) {
                    throw new Error('[[register:invite.error-admin-only]]');
                }
                else {
                    throw new Error('[[register:invite.error-invite-only]]');
                }
            }
            const token = yield database_1.default.getObjectField(`invitation:token:${query.token}`, 'token');
            if (!token || token !== query.token) {
                throw new Error('[[register:invite.error-invalid-data]]');
            }
        });
    };
    User.confirmIfInviteEmailIsUsed = function (token, enteredEmail, uid) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!enteredEmail) {
                return;
            }
            const email = yield database_1.default.getObjectField(`invitation:token:${token}`, 'email');
            // "Confirm" user's email if registration completed with invited address
            if (email && email === enteredEmail) {
                yield User.setUserField(uid, 'email', email);
                yield User.email.confirmByUid(uid);
            }
        });
    };
    User.joinGroupsFromInvitation = function (uid, token) {
        return __awaiter(this, void 0, void 0, function* () {
            let groupsToJoin = yield database_1.default.getObjectField(`invitation:token:${token}`, 'groupsToJoin');
            try {
                groupsToJoin = JSON.parse(groupsToJoin);
            }
            catch (e) {
                return;
            }
            if (!groupsToJoin || groupsToJoin.length < 1) {
                return;
            }
            yield groups.join(groupsToJoin, uid);
        });
    };
    User.deleteInvitation = function (invitedBy, email) {
        return __awaiter(this, void 0, void 0, function* () {
            const invitedByUid = yield User.getUidByUsername(invitedBy);
            if (!invitedByUid) {
                throw new Error('[[error:invalid-username]]');
            }
            const token = yield database_1.default.get(`invitation:uid:${invitedByUid}:invited:${email}`);
            yield Promise.all([
                deleteFromReferenceList(invitedByUid, email),
                database_1.default.setRemove(`invitation:invited:${email}`, token),
                database_1.default.delete(`invitation:token:${token}`),
            ]);
        });
    };
    User.deleteInvitationKey = function (registrationEmail, token) {
        return __awaiter(this, void 0, void 0, function* () {
            if (registrationEmail) {
                const uids = yield User.getInvitingUsers();
                yield Promise.all(uids.map(uid => deleteFromReferenceList(uid, registrationEmail)));
                // Delete all invites to an email address if it has joined
                const tokens = yield database_1.default.getSetMembers(`invitation:invited:${registrationEmail}`);
                const keysToDelete = [`invitation:invited:${registrationEmail}`].concat(tokens.map(token => `invitation:token:${token}`));
                yield database_1.default.deleteAll(keysToDelete);
            }
            if (token) {
                const invite = yield database_1.default.getObject(`invitation:token:${token}`);
                if (!invite) {
                    return;
                }
                yield deleteFromReferenceList(invite.inviter, invite.email);
                yield database_1.default.deleteAll([
                    `invitation:invited:${invite.email}`,
                    `invitation:token:${token}`,
                ]);
            }
        });
    };
    function deleteFromReferenceList(uid, email) {
        return __awaiter(this, void 0, void 0, function* () {
            yield Promise.all([
                database_1.default.setRemove(`invitation:uid:${uid}`, email),
                database_1.default.delete(`invitation:uid:${uid}:invited:${email}`),
            ]);
            const count = yield database_1.default.setCount(`invitation:uid:${uid}`);
            if (count === 0) {
                yield database_1.default.setRemove('invitation:uids', uid);
            }
        });
    }
    function prepareInvitation(uid, email, groupsToJoin) {
        return __awaiter(this, void 0, void 0, function* () {
            const inviterExists = yield User.exists(uid);
            if (!inviterExists) {
                throw new Error('[[error:invalid-uid]]');
            }
            const token = utils.generateUUID();
            const registerLink = `${nconf_1.default.get('url')}/register?token=${token}`;
            const expireDays = meta_1.default.config.inviteExpiration;
            const expireIn = expireDays * 86400000;
            yield database_1.default.setAdd(`invitation:uid:${uid}`, email);
            yield database_1.default.setAdd('invitation:uids', uid);
            // Referencing from uid and email to token
            yield database_1.default.set(`invitation:uid:${uid}:invited:${email}`, token);
            // Keeping references for all invites to this email address
            yield database_1.default.setAdd(`invitation:invited:${email}`, token);
            yield database_1.default.setObject(`invitation:token:${token}`, {
                email,
                token,
                groupsToJoin: JSON.stringify(groupsToJoin),
                inviter: uid,
            });
            yield database_1.default.pexpireAt(`invitation:token:${token}`, Date.now() + expireIn);
            const username = yield User.getUserField(uid, 'username');
            const title = meta_1.default.config.title || meta_1.default.config.browserTitle || 'NodeBB';
            const subject = yield translator.translate(`[[email:invite, ${title}]]`, meta_1.default.config.defaultLang);
            return Object.assign(Object.assign({}, emailer._defaultPayload), { site_title: title, registerLink: registerLink, subject: subject, username: username, template: 'invitation', expireDays: expireDays });
        });
    }
}
exports.default = default_1;
;
