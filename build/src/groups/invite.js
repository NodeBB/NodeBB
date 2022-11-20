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
const database_1 = __importDefault(require("../database"));
const user_1 = __importDefault(require("../user"));
const slugify = require('../slugify');
const plugins = require('../plugins');
const notifications = require('../notifications');
function default_1(Groups) {
    Groups.requestMembership = function (groupName, uid) {
        return __awaiter(this, void 0, void 0, function* () {
            yield inviteOrRequestMembership(groupName, uid, 'request');
            const { displayname } = yield user_1.default.getUserFields(uid, ['username']);
            const [notification, owners] = yield Promise.all([
                notifications.create({
                    type: 'group-request-membership',
                    bodyShort: `[[groups:request.notification_title, ${displayname}]]`,
                    bodyLong: `[[groups:request.notification_text, ${displayname}, ${groupName}]]`,
                    nid: `group:${groupName}:uid:${uid}:request`,
                    path: `/groups/${slugify(groupName)}`,
                    from: uid,
                }),
                Groups.getOwners(groupName),
            ]);
            yield notifications.push(notification, owners);
        });
    };
    Groups.acceptMembership = function (groupName, uid) {
        return __awaiter(this, void 0, void 0, function* () {
            yield database_1.default.setsRemove([`group:${groupName}:pending`, `group:${groupName}:invited`], uid);
            yield Groups.join(groupName, uid);
            const notification = yield notifications.create({
                type: 'group-invite',
                bodyShort: `[[groups:membership.accept.notification_title, ${groupName}]]`,
                nid: `group:${groupName}:uid:${uid}:invite-accepted`,
                path: `/groups/${slugify(groupName)}`,
            });
            yield notifications.push(notification, [uid]);
        });
    };
    Groups.rejectMembership = function (groupNames, uid) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!Array.isArray(groupNames)) {
                groupNames = [groupNames];
            }
            const sets = [];
            groupNames.forEach(groupName => sets.push(`group:${groupName}:pending`, `group:${groupName}:invited`));
            yield database_1.default.setsRemove(sets, uid);
        });
    };
    Groups.invite = function (groupName, uids) {
        return __awaiter(this, void 0, void 0, function* () {
            uids = Array.isArray(uids) ? uids : [uids];
            uids = yield inviteOrRequestMembership(groupName, uids, 'invite');
            const notificationData = yield Promise.all(uids.map(uid => notifications.create({
                type: 'group-invite',
                bodyShort: `[[groups:invited.notification_title, ${groupName}]]`,
                bodyLong: '',
                nid: `group:${groupName}:uid:${uid}:invite`,
                path: `/groups/${slugify(groupName)}`,
            })));
            yield Promise.all(uids.map((uid, index) => notifications.push(notificationData[index], uid)));
        });
    };
    function inviteOrRequestMembership(groupName, uids, type) {
        return __awaiter(this, void 0, void 0, function* () {
            uids = Array.isArray(uids) ? uids : [uids];
            uids = uids.filter(uid => parseInt(uid, 10) > 0);
            const [exists, isMember, isPending, isInvited] = yield Promise.all([
                Groups.exists(groupName),
                Groups.isMembers(uids, groupName),
                Groups.isPending(uids, groupName),
                Groups.isInvited(uids, groupName),
            ]);
            if (!exists) {
                throw new Error('[[error:no-group]]');
            }
            uids = uids.filter((uid, i) => !isMember[i] && ((type === 'invite' && !isInvited[i]) || (type === 'request' && !isPending[i])));
            const set = type === 'invite' ? `group:${groupName}:invited` : `group:${groupName}:pending`;
            yield database_1.default.setAdd(set, uids);
            const hookName = type === 'invite' ? 'inviteMember' : 'requestMembership';
            plugins.hooks.fire(`action:group.${hookName}`, {
                groupName: groupName,
                uids: uids,
            });
            return uids;
        });
    }
    Groups.isInvited = function (uids, groupName) {
        return __awaiter(this, void 0, void 0, function* () {
            return yield checkInvitePending(uids, `group:${groupName}:invited`);
        });
    };
    Groups.isPending = function (uids, groupName) {
        return __awaiter(this, void 0, void 0, function* () {
            return yield checkInvitePending(uids, `group:${groupName}:pending`);
        });
    };
    function checkInvitePending(uids, set) {
        return __awaiter(this, void 0, void 0, function* () {
            const isArray = Array.isArray(uids);
            uids = isArray ? uids : [uids];
            const checkUids = uids.filter(uid => parseInt(uid, 10) > 0);
            const isMembers = yield database_1.default.isSetMembers(set, checkUids);
            const map = _.zipObject(checkUids, isMembers);
            return isArray ? uids.map(uid => !!map[uid]) : !!map[uids[0]];
        });
    }
    Groups.getPending = function (groupName) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!groupName) {
                return [];
            }
            return yield database_1.default.getSetMembers(`group:${groupName}:pending`);
        });
    };
}
exports.default = default_1;
;
