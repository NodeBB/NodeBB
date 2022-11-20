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
const database_1 = __importDefault(require("../database"));
const notifications = require('../notifications');
const Messaging = require('../messaging');
const utils = require('../utils');
const server = require('./index');
const user_1 = __importDefault(require("../user"));
const privileges = require('../privileges');
const sockets = require('.');
const api = require('../api');
const SocketModules = {};
SocketModules.chats = {};
SocketModules.settings = {};
/* Chat */
SocketModules.chats.getRaw = function (socket, data) {
    return __awaiter(this, void 0, void 0, function* () {
        if (!data || !data.hasOwnProperty('mid')) {
            throw new Error('[[error:invalid-data]]');
        }
        const roomId = yield Messaging.getMessageField(data.mid, 'roomId');
        const [isAdmin, hasMessage, inRoom] = yield Promise.all([
            user_1.default.isAdministrator(socket.uid),
            database_1.default.isSortedSetMember(`uid:${socket.uid}:chat:room:${roomId}:mids`, data.mid),
            Messaging.isUserInRoom(socket.uid, roomId),
        ]);
        if (!isAdmin && (!inRoom || !hasMessage)) {
            throw new Error('[[error:not-allowed]]');
        }
        return yield Messaging.getMessageField(data.mid, 'content');
    });
};
SocketModules.chats.isDnD = function (socket, uid) {
    return __awaiter(this, void 0, void 0, function* () {
        const status = yield database_1.default.getObjectField(`user:${uid}`, 'status');
        return status === 'dnd';
    });
};
SocketModules.chats.newRoom = function (socket, data) {
    return __awaiter(this, void 0, void 0, function* () {
        sockets.warnDeprecated(socket, 'POST /api/v3/chats');
        if (!data) {
            throw new Error('[[error:invalid-data]]');
        }
        const roomObj = yield api.chats.create(socket, {
            uids: [data.touid],
        });
        return roomObj.roomId;
    });
};
SocketModules.chats.send = function (socket, data) {
    return __awaiter(this, void 0, void 0, function* () {
        sockets.warnDeprecated(socket, 'POST /api/v3/chats/:roomId');
        if (!data || !data.roomId || !socket.uid) {
            throw new Error('[[error:invalid-data]]');
        }
        const canChat = yield privileges.global.can('chat', socket.uid);
        if (!canChat) {
            throw new Error('[[error:no-privileges]]');
        }
        return api.chats.post(socket, data);
    });
};
SocketModules.chats.loadRoom = function (socket, data) {
    return __awaiter(this, void 0, void 0, function* () {
        sockets.warnDeprecated(socket, 'GET /api/v3/chats/:roomId');
        if (!data || !data.roomId) {
            throw new Error('[[error:invalid-data]]');
        }
        return yield Messaging.loadRoom(socket.uid, data);
    });
};
SocketModules.chats.getUsersInRoom = function (socket, data) {
    return __awaiter(this, void 0, void 0, function* () {
        sockets.warnDeprecated(socket, 'GET /api/v3/chats/:roomId/users');
        if (!data || !data.roomId) {
            throw new Error('[[error:invalid-data]]');
        }
        const isUserInRoom = yield Messaging.isUserInRoom(socket.uid, data.roomId);
        if (!isUserInRoom) {
            throw new Error('[[error:no-privileges]]');
        }
        return api.chats.users(socket, data);
    });
};
SocketModules.chats.addUserToRoom = function (socket, data) {
    return __awaiter(this, void 0, void 0, function* () {
        sockets.warnDeprecated(socket, 'POST /api/v3/chats/:roomId/users');
        if (!data || !data.roomId || !data.username) {
            throw new Error('[[error:invalid-data]]');
        }
        const canChat = yield privileges.global.can('chat', socket.uid);
        if (!canChat) {
            throw new Error('[[error:no-privileges]]');
        }
        // Revised API now takes uids, not usernames
        data.uids = [yield user_1.default.getUidByUsername(data.username)];
        delete data.username;
        yield api.chats.invite(socket, data);
    });
};
SocketModules.chats.removeUserFromRoom = function (socket, data) {
    return __awaiter(this, void 0, void 0, function* () {
        sockets.warnDeprecated(socket, 'DELETE /api/v3/chats/:roomId/users OR DELETE /api/v3/chats/:roomId/users/:uid');
        if (!data || !data.roomId) {
            throw new Error('[[error:invalid-data]]');
        }
        // Revised API can accept multiple uids now
        data.uids = [data.uid];
        delete data.uid;
        yield api.chats.kick(socket, data);
    });
};
SocketModules.chats.leave = function (socket, roomid) {
    return __awaiter(this, void 0, void 0, function* () {
        sockets.warnDeprecated(socket, 'DELETE /api/v3/chats/:roomId/users OR DELETE /api/v3/chats/:roomId/users/:uid');
        if (!socket.uid || !roomid) {
            throw new Error('[[error:invalid-data]]');
        }
        yield Messaging.leaveRoom([socket.uid], roomid);
    });
};
SocketModules.chats.edit = function (socket, data) {
    return __awaiter(this, void 0, void 0, function* () {
        sockets.warnDeprecated(socket, 'PUT /api/v3/chats/:roomId/:mid');
        if (!data || !data.roomId || !data.message) {
            throw new Error('[[error:invalid-data]]');
        }
        yield Messaging.canEdit(data.mid, socket.uid);
        yield Messaging.editMessage(socket.uid, data.mid, data.roomId, data.message);
    });
};
SocketModules.chats.delete = function (socket, data) {
    return __awaiter(this, void 0, void 0, function* () {
        sockets.warnDeprecated(socket, 'DELETE /api/v3/chats/:roomId/:mid');
        if (!data || !data.roomId || !data.messageId) {
            throw new Error('[[error:invalid-data]]');
        }
        yield Messaging.canDelete(data.messageId, socket.uid);
        yield Messaging.deleteMessage(data.messageId, socket.uid);
    });
};
SocketModules.chats.restore = function (socket, data) {
    return __awaiter(this, void 0, void 0, function* () {
        sockets.warnDeprecated(socket, 'POST /api/v3/chats/:roomId/:mid');
        if (!data || !data.roomId || !data.messageId) {
            throw new Error('[[error:invalid-data]]');
        }
        yield Messaging.canDelete(data.messageId, socket.uid);
        yield Messaging.restoreMessage(data.messageId, socket.uid);
    });
};
SocketModules.chats.canMessage = function (socket, roomId) {
    return __awaiter(this, void 0, void 0, function* () {
        yield Messaging.canMessageRoom(socket.uid, roomId);
    });
};
SocketModules.chats.markRead = function (socket, roomId) {
    return __awaiter(this, void 0, void 0, function* () {
        if (!socket.uid || !roomId) {
            throw new Error('[[error:invalid-data]]');
        }
        const [uidsInRoom] = yield Promise.all([
            Messaging.getUidsInRoom(roomId, 0, -1),
            Messaging.markRead(socket.uid, roomId),
        ]);
        Messaging.pushUnreadCount(socket.uid);
        server.in(`uid_${socket.uid}`).emit('event:chats.markedAsRead', { roomId: roomId });
        if (!uidsInRoom.includes(String(socket.uid))) {
            return;
        }
        // Mark notification read
        const nids = uidsInRoom.filter(uid => parseInt(uid, 10) !== socket.uid)
            .map(uid => `chat_${uid}_${roomId}`);
        yield notifications.markReadMultiple(nids, socket.uid);
        yield user_1.default.notifications.pushCount(socket.uid);
    });
};
SocketModules.chats.markAllRead = function (socket) {
    return __awaiter(this, void 0, void 0, function* () {
        yield Messaging.markAllRead(socket.uid);
        Messaging.pushUnreadCount(socket.uid);
    });
};
SocketModules.chats.renameRoom = function (socket, data) {
    return __awaiter(this, void 0, void 0, function* () {
        sockets.warnDeprecated(socket, 'PUT /api/v3/chats/:roomId');
        if (!data || !data.roomId || !data.newName) {
            throw new Error('[[error:invalid-data]]');
        }
        data.name = data.newName;
        delete data.newName;
        yield api.chats.rename(socket, data);
    });
};
SocketModules.chats.getRecentChats = function (socket, data) {
    return __awaiter(this, void 0, void 0, function* () {
        if (!data || !utils.isNumber(data.after) || !utils.isNumber(data.uid)) {
            throw new Error('[[error:invalid-data]]');
        }
        const start = parseInt(data.after, 10);
        const stop = start + 9;
        return yield Messaging.getRecentChats(socket.uid, data.uid, start, stop);
    });
};
SocketModules.chats.hasPrivateChat = function (socket, uid) {
    return __awaiter(this, void 0, void 0, function* () {
        if (socket.uid <= 0 || uid <= 0) {
            throw new Error('[[error:invalid-data]]');
        }
        return yield Messaging.hasPrivateChat(socket.uid, uid);
    });
};
SocketModules.chats.getMessages = function (socket, data) {
    return __awaiter(this, void 0, void 0, function* () {
        sockets.warnDeprecated(socket, 'GET /api/v3/chats/:roomId/messages');
        if (!socket.uid || !data || !data.uid || !data.roomId) {
            throw new Error('[[error:invalid-data]]');
        }
        return yield Messaging.getMessages({
            callerUid: socket.uid,
            uid: data.uid,
            roomId: data.roomId,
            start: parseInt(data.start, 10) || 0,
            count: 50,
        });
    });
};
SocketModules.chats.getIP = function (socket, mid) {
    return __awaiter(this, void 0, void 0, function* () {
        const allowed = yield privileges.global.can('view:users:info', socket.uid);
        if (!allowed) {
            throw new Error('[[error:no-privilege]]');
        }
        return yield Messaging.getMessageField(mid, 'ip');
    });
};
require('../promisify').promisify(SocketModules);
