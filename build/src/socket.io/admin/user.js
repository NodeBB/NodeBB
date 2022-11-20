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
const winston_1 = __importDefault(require("winston"));
const database_1 = __importDefault(require("../../database"));
const groups = require('../../groups');
const user_1 = __importDefault(require("../../user"));
const events = require('../../events');
const translator = require('../../translator');
const sockets = require('..');
const User = {};
User.makeAdmins = function (socket, uids) {
    return __awaiter(this, void 0, void 0, function* () {
        if (!Array.isArray(uids)) {
            throw new Error('[[error:invalid-data]]');
        }
        const isMembersOfBanned = yield groups.isMembers(uids, groups.BANNED_USERS);
        if (isMembersOfBanned.includes(true)) {
            throw new Error('[[error:cant-make-banned-users-admin]]');
        }
        for (const uid of uids) {
            /* eslint-disable no-await-in-loop */
            yield groups.join('administrators', uid);
            yield events.log({
                type: 'user-makeAdmin',
                uid: socket.uid,
                targetUid: uid,
                ip: socket.ip,
            });
        }
    });
};
User.removeAdmins = function (socket, uids) {
    return __awaiter(this, void 0, void 0, function* () {
        if (!Array.isArray(uids)) {
            throw new Error('[[error:invalid-data]]');
        }
        for (const uid of uids) {
            /* eslint-disable no-await-in-loop */
            const count = yield groups.getMemberCount('administrators');
            if (count === 1) {
                throw new Error('[[error:cant-remove-last-admin]]');
            }
            yield groups.leave('administrators', uid);
            yield events.log({
                type: 'user-removeAdmin',
                uid: socket.uid,
                targetUid: uid,
                ip: socket.ip,
            });
        }
    });
};
User.resetLockouts = function (socket, uids) {
    return __awaiter(this, void 0, void 0, function* () {
        if (!Array.isArray(uids)) {
            throw new Error('[[error:invalid-data]]');
        }
        yield Promise.all(uids.map(uid => user_1.default.auth.resetLockout(uid)));
    });
};
User.validateEmail = function (socket, uids) {
    return __awaiter(this, void 0, void 0, function* () {
        if (!Array.isArray(uids)) {
            throw new Error('[[error:invalid-data]]');
        }
        for (const uid of uids) {
            yield user_1.default.email.confirmByUid(uid);
        }
    });
};
User.sendValidationEmail = function (socket, uids) {
    return __awaiter(this, void 0, void 0, function* () {
        if (!Array.isArray(uids)) {
            throw new Error('[[error:invalid-data]]');
        }
        const failed = [];
        let errorLogged = false;
        yield async.eachLimit(uids, 50, (uid) => __awaiter(this, void 0, void 0, function* () {
            yield user_1.default.email.sendValidationEmail(uid, { force: true }).catch((err) => {
                if (!errorLogged) {
                    winston_1.default.error(`[user.create] Validation email failed to send\n[emailer.send] ${err.stack}`);
                    errorLogged = true;
                }
                failed.push(uid);
            });
        }));
        if (failed.length) {
            throw Error(`Email sending failed for the following uids, check server logs for more info: ${failed.join(',')}`);
        }
    });
};
User.sendPasswordResetEmail = function (socket, uids) {
    return __awaiter(this, void 0, void 0, function* () {
        if (!Array.isArray(uids)) {
            throw new Error('[[error:invalid-data]]');
        }
        uids = uids.filter(uid => parseInt(uid, 10));
        yield Promise.all(uids.map((uid) => __awaiter(this, void 0, void 0, function* () {
            const userData = yield user_1.default.getUserFields(uid, ['email', 'username']);
            if (!userData.email) {
                throw new Error(`[[error:user-doesnt-have-email, ${userData.username}]]`);
            }
            yield user_1.default.reset.send(userData.email);
        })));
    });
};
User.forcePasswordReset = function (socket, uids) {
    return __awaiter(this, void 0, void 0, function* () {
        if (!Array.isArray(uids)) {
            throw new Error('[[error:invalid-data]]');
        }
        uids = uids.filter(uid => parseInt(uid, 10));
        yield database_1.default.setObjectField(uids.map(uid => `user:${uid}`), 'passwordExpiry', Date.now());
        yield user_1.default.auth.revokeAllSessions(uids);
        uids.forEach(uid => sockets.in(`uid_${uid}`).emit('event:logout'));
    });
};
User.restartJobs = function () {
    return __awaiter(this, void 0, void 0, function* () {
        user_1.default.startJobs();
    });
};
User.loadGroups = function (socket, uids) {
    return __awaiter(this, void 0, void 0, function* () {
        const [userData, groupData] = yield Promise.all([
            user_1.default.getUsersData(uids),
            groups.getUserGroupsFromSet('groups:createtime', uids),
        ]);
        userData.forEach((data, index) => {
            data.groups = groupData[index].filter(group => !groups.isPrivilegeGroup(group.name));
            data.groups.forEach((group) => {
                group.nameEscaped = translator.escape(group.displayName);
            });
        });
        return { users: userData };
    });
};
User.exportUsersCSV = function (socket) {
    return __awaiter(this, void 0, void 0, function* () {
        yield events.log({
            type: 'exportUsersCSV',
            uid: socket.uid,
            ip: socket.ip,
        });
        setTimeout(() => __awaiter(this, void 0, void 0, function* () {
            try {
                yield user_1.default.exportUsersCSV();
                if (socket.emit) {
                    socket.emit('event:export-users-csv');
                }
                const notifications = require('../../notifications');
                const n = yield notifications.create({
                    bodyShort: '[[notifications:users-csv-exported]]',
                    path: '/api/admin/users/csv',
                    nid: 'users:csv:export',
                    from: socket.uid,
                });
                yield notifications.push(n, [socket.uid]);
            }
            catch (err) {
                winston_1.default.error(err.stack);
            }
        }), 0);
    });
};
