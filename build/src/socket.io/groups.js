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
const groups = require('../groups');
const user_1 = __importDefault(require("../user"));
const utils = require('../utils');
const events = require('../events');
const privileges = require('../privileges');
const SocketGroups = {};
SocketGroups.before = (socket, method, data) => __awaiter(void 0, void 0, void 0, function* () {
    if (!data) {
        throw new Error('[[error:invalid-data]]');
    }
});
SocketGroups.addMember = (socket, data) => __awaiter(void 0, void 0, void 0, function* () {
    yield isOwner(socket, data);
    if (data.groupName === 'administrators' || groups.isPrivilegeGroup(data.groupName)) {
        throw new Error('[[error:not-allowed]]');
    }
    if (!data.uid) {
        throw new Error('[[error:invalid-data]]');
    }
    data.uid = !Array.isArray(data.uid) ? [data.uid] : data.uid;
    if (data.uid.filter(uid => !(parseInt(uid, 10) > 0)).length) {
        throw new Error('[[error:invalid-uid]]');
    }
    for (const uid of data.uid) {
        // eslint-disable-next-line no-await-in-loop
        yield groups.join(data.groupName, uid);
    }
    logGroupEvent(socket, 'group-add-member', {
        groupName: data.groupName,
        targetUid: String(data.uid),
    });
});
function isOwner(socket, data) {
    return __awaiter(this, void 0, void 0, function* () {
        if (typeof data.groupName !== 'string') {
            throw new Error('[[error:invalid-group-name]]');
        }
        const results = yield utils.promiseParallel({
            hasAdminPrivilege: privileges.admin.can('admin:groups', socket.uid),
            isGlobalModerator: user_1.default.isGlobalModerator(socket.uid),
            isOwner: groups.ownership.isOwner(socket.uid, data.groupName),
            group: groups.getGroupData(data.groupName),
        });
        const isOwner = results.isOwner ||
            results.hasAdminPrivilege ||
            (results.isGlobalModerator && !results.group.system);
        if (!isOwner) {
            throw new Error('[[error:no-privileges]]');
        }
    });
}
function isInvited(socket, data) {
    return __awaiter(this, void 0, void 0, function* () {
        if (typeof data.groupName !== 'string') {
            throw new Error('[[error:invalid-group-name]]');
        }
        const invited = yield groups.isInvited(socket.uid, data.groupName);
        if (!invited) {
            throw new Error('[[error:not-invited]]');
        }
    });
}
SocketGroups.accept = (socket, data) => __awaiter(void 0, void 0, void 0, function* () {
    yield isOwner(socket, data);
    yield groups.acceptMembership(data.groupName, data.toUid);
    logGroupEvent(socket, 'group-accept-membership', {
        groupName: data.groupName,
        targetUid: data.toUid,
    });
});
SocketGroups.reject = (socket, data) => __awaiter(void 0, void 0, void 0, function* () {
    yield isOwner(socket, data);
    yield groups.rejectMembership(data.groupName, data.toUid);
    logGroupEvent(socket, 'group-reject-membership', {
        groupName: data.groupName,
        targetUid: data.toUid,
    });
});
SocketGroups.acceptAll = (socket, data) => __awaiter(void 0, void 0, void 0, function* () {
    yield isOwner(socket, data);
    yield acceptRejectAll(SocketGroups.accept, socket, data);
});
SocketGroups.rejectAll = (socket, data) => __awaiter(void 0, void 0, void 0, function* () {
    yield isOwner(socket, data);
    yield acceptRejectAll(SocketGroups.reject, socket, data);
});
function acceptRejectAll(method, socket, data) {
    return __awaiter(this, void 0, void 0, function* () {
        if (typeof data.groupName !== 'string') {
            throw new Error('[[error:invalid-group-name]]');
        }
        const uids = yield groups.getPending(data.groupName);
        yield Promise.all(uids.map((uid) => __awaiter(this, void 0, void 0, function* () {
            yield method(socket, { groupName: data.groupName, toUid: uid });
        })));
    });
}
SocketGroups.issueInvite = (socket, data) => __awaiter(void 0, void 0, void 0, function* () {
    yield isOwner(socket, data);
    yield groups.invite(data.groupName, data.toUid);
    logGroupEvent(socket, 'group-invite', {
        groupName: data.groupName,
        targetUid: data.toUid,
    });
});
SocketGroups.issueMassInvite = (socket, data) => __awaiter(void 0, void 0, void 0, function* () {
    yield isOwner(socket, data);
    if (!data || !data.usernames || !data.groupName) {
        throw new Error('[[error:invalid-data]]');
    }
    let usernames = String(data.usernames).split(',');
    usernames = usernames.map(username => username && username.trim());
    let uids = yield user_1.default.getUidsByUsernames(usernames);
    uids = uids.filter(uid => !!uid && parseInt(uid, 10));
    yield groups.invite(data.groupName, uids);
    for (const uid of uids) {
        logGroupEvent(socket, 'group-invite', {
            groupName: data.groupName,
            targetUid: uid,
        });
    }
});
SocketGroups.rescindInvite = (socket, data) => __awaiter(void 0, void 0, void 0, function* () {
    yield isOwner(socket, data);
    yield groups.rejectMembership(data.groupName, data.toUid);
});
SocketGroups.acceptInvite = (socket, data) => __awaiter(void 0, void 0, void 0, function* () {
    yield isInvited(socket, data);
    yield groups.acceptMembership(data.groupName, socket.uid);
    logGroupEvent(socket, 'group-invite-accept', {
        groupName: data.groupName,
    });
});
SocketGroups.rejectInvite = (socket, data) => __awaiter(void 0, void 0, void 0, function* () {
    yield isInvited(socket, data);
    yield groups.rejectMembership(data.groupName, socket.uid);
    logGroupEvent(socket, 'group-invite-reject', {
        groupName: data.groupName,
    });
});
SocketGroups.kick = (socket, data) => __awaiter(void 0, void 0, void 0, function* () {
    yield isOwner(socket, data);
    if (socket.uid === parseInt(data.uid, 10)) {
        throw new Error('[[error:cant-kick-self]]');
    }
    const isOwnerBit = yield groups.ownership.isOwner(data.uid, data.groupName);
    yield groups.kick(data.uid, data.groupName, isOwnerBit);
    logGroupEvent(socket, 'group-kick', {
        groupName: data.groupName,
        targetUid: data.uid,
    });
});
SocketGroups.search = (socket, data) => __awaiter(void 0, void 0, void 0, function* () {
    data.options = data.options || {};
    if (!data.query) {
        const groupsPerPage = 15;
        const groupData = yield groups.getGroupsBySort(data.options.sort, 0, groupsPerPage - 1);
        return groupData;
    }
    data.options.filterHidden = data.options.filterHidden || !(yield user_1.default.isAdministrator(socket.uid));
    return yield groups.search(data.query, data.options);
});
SocketGroups.loadMore = (socket, data) => __awaiter(void 0, void 0, void 0, function* () {
    if (!data.sort || !utils.isNumber(data.after) || parseInt(data.after, 10) < 0) {
        throw new Error('[[error:invalid-data]]');
    }
    const groupsPerPage = 10;
    const start = parseInt(data.after, 10);
    const stop = start + groupsPerPage - 1;
    const groupData = yield groups.getGroupsBySort(data.sort, start, stop);
    return { groups: groupData, nextStart: stop + 1 };
});
SocketGroups.searchMembers = (socket, data) => __awaiter(void 0, void 0, void 0, function* () {
    if (!data.groupName) {
        throw new Error('[[error:invalid-data]]');
    }
    yield canSearchMembers(socket.uid, data.groupName);
    if (!(yield privileges.global.can('search:users', socket.uid))) {
        throw new Error('[[error:no-privileges]]');
    }
    return yield groups.searchMembers({
        uid: socket.uid,
        query: data.query,
        groupName: data.groupName,
    });
});
SocketGroups.loadMoreMembers = (socket, data) => __awaiter(void 0, void 0, void 0, function* () {
    if (!data.groupName || !utils.isNumber(data.after) || parseInt(data.after, 10) < 0) {
        throw new Error('[[error:invalid-data]]');
    }
    yield canSearchMembers(socket.uid, data.groupName);
    data.after = parseInt(data.after, 10);
    const users = yield groups.getOwnersAndMembers(data.groupName, socket.uid, data.after, data.after + 9);
    return {
        users: users,
        nextStart: data.after + 10,
    };
});
function canSearchMembers(uid, groupName) {
    return __awaiter(this, void 0, void 0, function* () {
        const [isHidden, isMember, hasAdminPrivilege, isGlobalMod, viewGroups] = yield Promise.all([
            groups.isHidden(groupName),
            groups.isMember(uid, groupName),
            privileges.admin.can('admin:groups', uid),
            user_1.default.isGlobalModerator(uid),
            privileges.global.can('view:groups', uid),
        ]);
        if (!viewGroups || (isHidden && !isMember && !hasAdminPrivilege && !isGlobalMod)) {
            throw new Error('[[error:no-privileges]]');
        }
    });
}
SocketGroups.cover = {};
SocketGroups.cover.update = (socket, data) => __awaiter(void 0, void 0, void 0, function* () {
    if (!socket.uid) {
        throw new Error('[[error:no-privileges]]');
    }
    if (data.file || (!data.imageData && !data.position)) {
        throw new Error('[[error:invalid-data]]');
    }
    yield canModifyGroup(socket.uid, data.groupName);
    return yield groups.updateCover(socket.uid, {
        groupName: data.groupName,
        imageData: data.imageData,
        position: data.position,
    });
});
SocketGroups.cover.remove = (socket, data) => __awaiter(void 0, void 0, void 0, function* () {
    if (!socket.uid) {
        throw new Error('[[error:no-privileges]]');
    }
    yield canModifyGroup(socket.uid, data.groupName);
    yield groups.removeCover({
        groupName: data.groupName,
    });
});
function canModifyGroup(uid, groupName) {
    return __awaiter(this, void 0, void 0, function* () {
        if (typeof groupName !== 'string') {
            throw new Error('[[error:invalid-group-name]]');
        }
        const results = yield utils.promiseParallel({
            isOwner: groups.ownership.isOwner(uid, groupName),
            system: groups.getGroupField(groupName, 'system'),
            hasAdminPrivilege: privileges.admin.can('admin:groups', uid),
            isGlobalMod: user_1.default.isGlobalModerator(uid),
        });
        if (!(results.isOwner || results.hasAdminPrivilege || (results.isGlobalMod && !results.system))) {
            throw new Error('[[error:no-privileges]]');
        }
    });
}
function logGroupEvent(socket, event, additional) {
    events.log(Object.assign({ type: event, uid: socket.uid, ip: socket.ip }, additional));
}
require('../promisify').promisify(SocketGroups);
