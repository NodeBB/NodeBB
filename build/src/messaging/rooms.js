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
const database_1 = __importDefault(require("../database"));
const user_1 = __importDefault(require("../user"));
const plugins = require('../plugins');
const privileges = require('../privileges');
const meta_1 = __importDefault(require("../meta"));
function default_1(Messaging) {
    Messaging.getRoomData = (roomId) => __awaiter(this, void 0, void 0, function* () {
        const data = yield database_1.default.getObject(`chat:room:${roomId}`);
        if (!data) {
            throw new Error('[[error:no-chat-room]]');
        }
        modifyRoomData([data]);
        return data;
    });
    Messaging.getRoomsData = (roomIds) => __awaiter(this, void 0, void 0, function* () {
        const roomData = yield database_1.default.getObjects(roomIds.map(roomId => `chat:room:${roomId}`));
        modifyRoomData(roomData);
        return roomData;
    });
    function modifyRoomData(rooms) {
        rooms.forEach((data) => {
            if (data) {
                data.roomName = data.roomName || '';
                data.roomName = validator.escape(String(data.roomName));
                if (data.hasOwnProperty('groupChat')) {
                    data.groupChat = parseInt(data.groupChat, 10) === 1;
                }
            }
        });
    }
    Messaging.newRoom = (uid, toUids) => __awaiter(this, void 0, void 0, function* () {
        const now = Date.now();
        const roomId = yield database_1.default.incrObjectField('global', 'nextChatRoomId');
        const room = {
            owner: uid,
            roomId: roomId,
        };
        yield Promise.all([
            database_1.default.setObject(`chat:room:${roomId}`, room),
            database_1.default.sortedSetAdd(`chat:room:${roomId}:uids`, now, uid),
        ]);
        yield Promise.all([
            Messaging.addUsersToRoom(uid, toUids, roomId),
            Messaging.addRoomToUsers(roomId, [uid].concat(toUids), now),
        ]);
        // chat owner should also get the user-join system message
        yield Messaging.addSystemMessage('user-join', uid, roomId);
        return roomId;
    });
    Messaging.isUserInRoom = (uid, roomId) => __awaiter(this, void 0, void 0, function* () {
        const inRoom = yield database_1.default.isSortedSetMember(`chat:room:${roomId}:uids`, uid);
        const data = yield plugins.hooks.fire('filter:messaging.isUserInRoom', { uid: uid, roomId: roomId, inRoom: inRoom });
        return data.inRoom;
    });
    Messaging.roomExists = (roomId) => __awaiter(this, void 0, void 0, function* () { return database_1.default.exists(`chat:room:${roomId}:uids`); });
    Messaging.getUserCountInRoom = (roomId) => __awaiter(this, void 0, void 0, function* () { return database_1.default.sortedSetCard(`chat:room:${roomId}:uids`); });
    Messaging.isRoomOwner = (uids, roomId) => __awaiter(this, void 0, void 0, function* () {
        const isArray = Array.isArray(uids);
        if (!isArray) {
            uids = [uids];
        }
        const owner = yield database_1.default.getObjectField(`chat:room:${roomId}`, 'owner');
        const isOwners = uids.map(uid => parseInt(uid, 10) === parseInt(owner, 10));
        const result = yield Promise.all(isOwners.map((isOwner, index) => __awaiter(this, void 0, void 0, function* () {
            const payload = yield plugins.hooks.fire('filter:messaging.isRoomOwner', { uid: uids[index], roomId, owner, isOwner });
            return payload.isOwner;
        })));
        return isArray ? result : result[0];
    });
    Messaging.addUsersToRoom = function (uid, uids, roomId) {
        return __awaiter(this, void 0, void 0, function* () {
            const inRoom = yield Messaging.isUserInRoom(uid, roomId);
            const payload = yield plugins.hooks.fire('filter:messaging.addUsersToRoom', { uid, uids, roomId, inRoom });
            if (!payload.inRoom) {
                throw new Error('[[error:cant-add-users-to-chat-room]]');
            }
            const now = Date.now();
            const timestamps = payload.uids.map(() => now);
            yield database_1.default.sortedSetAdd(`chat:room:${payload.roomId}:uids`, timestamps, payload.uids);
            yield updateGroupChatField([payload.roomId]);
            yield Promise.all(payload.uids.map(uid => Messaging.addSystemMessage('user-join', uid, payload.roomId)));
        });
    };
    Messaging.removeUsersFromRoom = (uid, uids, roomId) => __awaiter(this, void 0, void 0, function* () {
        const [isOwner, userCount] = yield Promise.all([
            Messaging.isRoomOwner(uid, roomId),
            Messaging.getUserCountInRoom(roomId),
        ]);
        const payload = yield plugins.hooks.fire('filter:messaging.removeUsersFromRoom', { uid, uids, roomId, isOwner, userCount });
        if (!payload.isOwner) {
            throw new Error('[[error:cant-remove-users-from-chat-room]]');
        }
        yield Messaging.leaveRoom(payload.uids, payload.roomId);
    });
    Messaging.isGroupChat = function (roomId) {
        return __awaiter(this, void 0, void 0, function* () {
            return (yield Messaging.getRoomData(roomId)).groupChat;
        });
    };
    function updateGroupChatField(roomIds) {
        return __awaiter(this, void 0, void 0, function* () {
            const userCounts = yield database_1.default.sortedSetsCard(roomIds.map(roomId => `chat:room:${roomId}:uids`));
            const groupChats = roomIds.filter((roomId, index) => userCounts[index] > 2);
            const privateChats = roomIds.filter((roomId, index) => userCounts[index] <= 2);
            yield database_1.default.setObjectBulk([
                ...groupChats.map(id => [`chat:room:${id}`, { groupChat: 1 }]),
                ...privateChats.map(id => [`chat:room:${id}`, { groupChat: 0 }]),
            ]);
        });
    }
    Messaging.leaveRoom = (uids, roomId) => __awaiter(this, void 0, void 0, function* () {
        const isInRoom = yield Promise.all(uids.map(uid => Messaging.isUserInRoom(uid, roomId)));
        uids = uids.filter((uid, index) => isInRoom[index]);
        const keys = uids
            .map(uid => `uid:${uid}:chat:rooms`)
            .concat(uids.map(uid => `uid:${uid}:chat:rooms:unread`));
        yield Promise.all([
            database_1.default.sortedSetRemove(`chat:room:${roomId}:uids`, uids),
            database_1.default.sortedSetsRemove(keys, roomId),
        ]);
        yield Promise.all(uids.map(uid => Messaging.addSystemMessage('user-leave', uid, roomId)));
        yield updateOwner(roomId);
        yield updateGroupChatField([roomId]);
    });
    Messaging.leaveRooms = (uid, roomIds) => __awaiter(this, void 0, void 0, function* () {
        const isInRoom = yield Promise.all(roomIds.map(roomId => Messaging.isUserInRoom(uid, roomId)));
        roomIds = roomIds.filter((roomId, index) => isInRoom[index]);
        const roomKeys = roomIds.map(roomId => `chat:room:${roomId}:uids`);
        yield Promise.all([
            database_1.default.sortedSetsRemove(roomKeys, uid),
            database_1.default.sortedSetRemove([
                `uid:${uid}:chat:rooms`,
                `uid:${uid}:chat:rooms:unread`,
            ], roomIds),
        ]);
        yield Promise.all(roomIds.map(roomId => updateOwner(roomId))
            .concat(roomIds.map(roomId => Messaging.addSystemMessage('user-leave', uid, roomId))));
        yield updateGroupChatField(roomIds);
    });
    function updateOwner(roomId) {
        return __awaiter(this, void 0, void 0, function* () {
            const uids = yield database_1.default.getSortedSetRange(`chat:room:${roomId}:uids`, 0, 0);
            const newOwner = uids[0] || 0;
            yield database_1.default.setObjectField(`chat:room:${roomId}`, 'owner', newOwner);
        });
    }
    Messaging.getUidsInRoom = (roomId, start, stop) => __awaiter(this, void 0, void 0, function* () { return database_1.default.getSortedSetRevRange(`chat:room:${roomId}:uids`, start, stop); });
    Messaging.getUsersInRoom = (roomId, start, stop) => __awaiter(this, void 0, void 0, function* () {
        const uids = yield Messaging.getUidsInRoom(roomId, start, stop);
        const [users, isOwners] = yield Promise.all([
            user_1.default.getUsersFields(uids, ['uid', 'username', 'picture', 'status']),
            Messaging.isRoomOwner(uids, roomId),
        ]);
        return users.map((user, index) => {
            user.isOwner = isOwners[index];
            return user;
        });
    });
    Messaging.renameRoom = function (uid, roomId, newName) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!newName) {
                throw new Error('[[error:invalid-data]]');
            }
            newName = newName.trim();
            if (newName.length > 75) {
                throw new Error('[[error:chat-room-name-too-long]]');
            }
            const payload = yield plugins.hooks.fire('filter:chat.renameRoom', {
                uid: uid,
                roomId: roomId,
                newName: newName,
            });
            const isOwner = yield Messaging.isRoomOwner(payload.uid, payload.roomId);
            if (!isOwner) {
                throw new Error('[[error:no-privileges]]');
            }
            yield database_1.default.setObjectField(`chat:room:${payload.roomId}`, 'roomName', payload.newName);
            yield Messaging.addSystemMessage(`room-rename, ${payload.newName.replace(',', '&#44;')}`, payload.uid, payload.roomId);
            plugins.hooks.fire('action:chat.renameRoom', {
                roomId: payload.roomId,
                newName: payload.newName,
            });
        });
    };
    Messaging.canReply = (roomId, uid) => __awaiter(this, void 0, void 0, function* () {
        const inRoom = yield database_1.default.isSortedSetMember(`chat:room:${roomId}:uids`, uid);
        const data = yield plugins.hooks.fire('filter:messaging.canReply', { uid: uid, roomId: roomId, inRoom: inRoom, canReply: inRoom });
        return data.canReply;
    });
    Messaging.loadRoom = (uid, data) => __awaiter(this, void 0, void 0, function* () {
        const canChat = yield privileges.global.can('chat', uid);
        if (!canChat) {
            throw new Error('[[error:no-privileges]]');
        }
        const inRoom = yield Messaging.isUserInRoom(uid, data.roomId);
        if (!inRoom) {
            return null;
        }
        const [room, canReply, users, messages, isAdminOrGlobalMod] = yield Promise.all([
            Messaging.getRoomData(data.roomId),
            Messaging.canReply(data.roomId, uid),
            Messaging.getUsersInRoom(data.roomId, 0, -1),
            Messaging.getMessages({
                callerUid: uid,
                uid: data.uid || uid,
                roomId: data.roomId,
                isNew: false,
            }),
            user_1.default.isAdminOrGlobalMod(uid),
        ]);
        room.messages = messages;
        room.isOwner = yield Messaging.isRoomOwner(uid, room.roomId);
        room.users = users.filter(user => user && parseInt(user.uid, 10) && parseInt(user.uid, 10) !== parseInt(uid, 10));
        room.canReply = canReply;
        room.groupChat = room.hasOwnProperty('groupChat') ? room.groupChat : users.length > 2;
        room.usernames = Messaging.generateUsernames(users, uid);
        room.maximumUsersInChatRoom = meta_1.default.config.maximumUsersInChatRoom;
        room.maximumChatMessageLength = meta_1.default.config.maximumChatMessageLength;
        room.showUserInput = !room.maximumUsersInChatRoom || room.maximumUsersInChatRoom > 2;
        room.isAdminOrGlobalMod = isAdminOrGlobalMod;
        const payload = yield plugins.hooks.fire('filter:messaging.loadRoom', { uid, data, room });
        return payload.room;
    });
}
exports.default = default_1;
;
