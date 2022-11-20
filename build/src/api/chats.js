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
const user_1 = __importDefault(require("../user"));
const meta_1 = __importDefault(require("../meta"));
const messaging = require('../messaging');
const plugins = require('../plugins');
// const websockets = require('../socket.io');
const socketHelpers = require('../socket.io/helpers');
const chatsAPI = {};
function rateLimitExceeded(caller) {
    const session = caller.request ? caller.request.session : caller.session; // socket vs req
    const now = Date.now();
    session.lastChatMessageTime = session.lastChatMessageTime || 0;
    if (now - session.lastChatMessageTime < meta_1.default.config.chatMessageDelay) {
        return true;
    }
    session.lastChatMessageTime = now;
    return false;
}
chatsAPI.create = function (caller, data) {
    return __awaiter(this, void 0, void 0, function* () {
        if (rateLimitExceeded(caller)) {
            throw new Error('[[error:too-many-messages]]');
        }
        if (!data.uids || !Array.isArray(data.uids)) {
            throw new Error(`[[error:wrong-parameter-type, uids, ${typeof data.uids}, Array]]`);
        }
        yield Promise.all(data.uids.map((uid) => __awaiter(this, void 0, void 0, function* () { return messaging.canMessageUser(caller.uid, uid); })));
        const roomId = yield messaging.newRoom(caller.uid, data.uids);
        return yield messaging.getRoomData(roomId);
    });
};
chatsAPI.post = (caller, data) => __awaiter(void 0, void 0, void 0, function* () {
    if (rateLimitExceeded(caller)) {
        throw new Error('[[error:too-many-messages]]');
    }
    ({ data } = yield plugins.hooks.fire('filter:messaging.send', {
        data,
        uid: caller.uid,
    }));
    yield messaging.canMessageRoom(caller.uid, data.roomId);
    const message = yield messaging.sendMessage({
        uid: caller.uid,
        roomId: data.roomId,
        content: data.message,
        timestamp: Date.now(),
        ip: caller.ip,
    });
    messaging.notifyUsersInRoom(caller.uid, data.roomId, message);
    user_1.default.updateOnlineUsers(caller.uid);
    return message;
});
chatsAPI.rename = (caller, data) => __awaiter(void 0, void 0, void 0, function* () {
    yield messaging.renameRoom(caller.uid, data.roomId, data.name);
    const uids = yield messaging.getUidsInRoom(data.roomId, 0, -1);
    const eventData = { roomId: data.roomId, newName: validator.escape(String(data.name)) };
    socketHelpers.emitToUids('event:chats.roomRename', eventData, uids);
    return messaging.loadRoom(caller.uid, {
        roomId: data.roomId,
    });
});
chatsAPI.users = (caller, data) => __awaiter(void 0, void 0, void 0, function* () {
    const [isOwner, users] = yield Promise.all([
        messaging.isRoomOwner(caller.uid, data.roomId),
        messaging.getUsersInRoom(data.roomId, 0, -1),
    ]);
    users.forEach((user) => {
        user.canKick = (parseInt(user.uid, 10) !== parseInt(caller.uid, 10)) && isOwner;
    });
    return { users };
});
chatsAPI.invite = (caller, data) => __awaiter(void 0, void 0, void 0, function* () {
    const userCount = yield messaging.getUserCountInRoom(data.roomId);
    const maxUsers = meta_1.default.config.maximumUsersInChatRoom;
    if (maxUsers && userCount >= maxUsers) {
        throw new Error('[[error:cant-add-more-users-to-chat-room]]');
    }
    const uidsExist = yield user_1.default.exists(data.uids);
    if (!uidsExist.every(Boolean)) {
        throw new Error('[[error:no-user]]');
    }
    yield Promise.all(data.uids.map((uid) => __awaiter(void 0, void 0, void 0, function* () { return messaging.canMessageUser(caller.uid, uid); })));
    yield messaging.addUsersToRoom(caller.uid, data.uids, data.roomId);
    delete data.uids;
    return chatsAPI.users(caller, data);
});
chatsAPI.kick = (caller, data) => __awaiter(void 0, void 0, void 0, function* () {
    const uidsExist = yield user_1.default.exists(data.uids);
    if (!uidsExist.every(Boolean)) {
        throw new Error('[[error:no-user]]');
    }
    // Additional checks if kicking vs leaving
    if (data.uids.length === 1 && parseInt(data.uids[0], 10) === caller.uid) {
        yield messaging.leaveRoom([caller.uid], data.roomId);
    }
    else {
        yield messaging.removeUsersFromRoom(caller.uid, data.uids, data.roomId);
    }
    delete data.uids;
    return chatsAPI.users(caller, data);
});
exports.default = chatsAPI;
