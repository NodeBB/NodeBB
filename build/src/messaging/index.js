'use strict';
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
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
const database = __importStar(require("../database"));
const db = database;
const user_1 = __importDefault(require("../user"));
const privileges = require('../privileges');
const plugins = require('../plugins');
const meta_1 = __importDefault(require("../meta"));
const utils = require('../utils');
const Messaging = {};
require('./data').default(Messaging);
require('./create').default(Messaging);
require('./delete').default(Messaging);
require('./edit').default(Messaging);
require('./rooms').default(Messaging);
require('./unread').default(Messaging);
require('./notifications').default(Messaging);
Messaging.messageExists = (mid) => __awaiter(void 0, void 0, void 0, function* () { return db.exists(`message:${mid}`); });
Messaging.getMessages = (params) => __awaiter(void 0, void 0, void 0, function* () {
    const isNew = params.isNew || false;
    const start = params.hasOwnProperty('start') ? params.start : 0;
    const stop = parseInt(start, 10) + ((params.count || 50) - 1);
    const indices = {};
    const ok = yield canGet('filter:messaging.canGetMessages', params.callerUid, params.uid);
    if (!ok) {
        return;
    }
    const mids = yield db.getSortedSetRevRange(`uid:${params.uid}:chat:room:${params.roomId}:mids`, start, stop);
    if (!mids.length) {
        return [];
    }
    mids.forEach((mid, index) => {
        indices[mid] = start + index;
    });
    mids.reverse();
    const messageData = yield Messaging.getMessagesData(mids, params.uid, params.roomId, isNew);
    messageData.forEach((messageData) => {
        messageData.index = indices[messageData.messageId.toString()];
        messageData.isOwner = messageData.fromuid === parseInt(params.uid, 10);
        if (messageData.deleted && !messageData.isOwner) {
            messageData.content = '[[modules:chat.message-deleted]]';
            messageData.cleanedContent = messageData.content;
        }
    });
    return messageData;
});
function canGet(hook, callerUid, uid) {
    return __awaiter(this, void 0, void 0, function* () {
        const data = yield plugins.hooks.fire(hook, {
            callerUid: callerUid,
            uid: uid,
            canGet: parseInt(callerUid, 10) === parseInt(uid, 10),
        });
        return data ? data.canGet : false;
    });
}
Messaging.parse = (message, fromuid, uid, roomId, isNew) => __awaiter(void 0, void 0, void 0, function* () {
    const parsed = yield plugins.hooks.fire('filter:parse.raw', String(message || ''));
    let messageData = {
        message: message,
        parsed: parsed,
        fromuid: fromuid,
        uid: uid,
        roomId: roomId,
        isNew: isNew,
        parsedMessage: parsed,
    };
    messageData = yield plugins.hooks.fire('filter:messaging.parse', messageData);
    return messageData ? messageData.parsedMessage : '';
});
Messaging.isNewSet = (uid, roomId, timestamp) => __awaiter(void 0, void 0, void 0, function* () {
    const setKey = `uid:${uid}:chat:room:${roomId}:mids`;
    const messages = yield db.getSortedSetRevRangeWithScores(setKey, 0, 0);
    if (messages && messages.length) {
        return parseInt(timestamp, 10) > parseInt(messages[0].score, 10) + Messaging.newMessageCutoff;
    }
    return true;
});
Messaging.getRecentChats = (callerUid, uid, start, stop) => __awaiter(void 0, void 0, void 0, function* () {
    const ok = yield canGet('filter:messaging.canGetRecentChats', callerUid, uid);
    if (!ok) {
        return null;
    }
    const roomIds = yield db.getSortedSetRevRange(`uid:${uid}:chat:rooms`, start, stop);
    const results = yield utils.promiseParallel({
        roomData: Messaging.getRoomsData(roomIds),
        unread: db.isSortedSetMembers(`uid:${uid}:chat:rooms:unread`, roomIds),
        users: Promise.all(roomIds.map((roomId) => __awaiter(void 0, void 0, void 0, function* () {
            let uids = yield db.getSortedSetRevRange(`chat:room:${roomId}:uids`, 0, 9);
            uids = uids.filter(_uid => _uid && parseInt(_uid, 10) !== parseInt(uid, 10));
            return yield user_1.default.getUsersFields(uids, ['uid', 'username', 'userslug', 'picture', 'status', 'lastonline']);
        }))),
        teasers: Promise.all(roomIds.map((roomId) => __awaiter(void 0, void 0, void 0, function* () { return Messaging.getTeaser(uid, roomId); }))),
    });
    results.roomData.forEach((room, index) => {
        if (room) {
            room.users = results.users[index];
            room.groupChat = room.hasOwnProperty('groupChat') ? room.groupChat : room.users.length > 2;
            room.unread = results.unread[index];
            room.teaser = results.teasers[index];
            room.users.forEach((userData) => {
                if (userData && parseInt(userData.uid, 10)) {
                    userData.status = user_1.default.getStatus(userData);
                }
            });
            room.users = room.users.filter(user => user && parseInt(user.uid, 10));
            room.lastUser = room.users[0];
            room.usernames = Messaging.generateUsernames(room.users, uid);
        }
    });
    results.roomData = results.roomData.filter(Boolean);
    const ref = { rooms: results.roomData, nextStart: stop + 1 };
    return yield plugins.hooks.fire('filter:messaging.getRecentChats', {
        rooms: ref.rooms,
        nextStart: ref.nextStart,
        uid: uid,
        callerUid: callerUid,
    });
});
Messaging.generateUsernames = (users, excludeUid) => users.filter(user => user && parseInt(user.uid, 10) !== excludeUid)
    .map(user => user.username).join(', ');
Messaging.getTeaser = (uid, roomId) => __awaiter(void 0, void 0, void 0, function* () {
    const mid = yield Messaging.getLatestUndeletedMessage(uid, roomId);
    if (!mid) {
        return null;
    }
    const teaser = yield Messaging.getMessageFields(mid, ['fromuid', 'content', 'timestamp']);
    if (!teaser.fromuid) {
        return null;
    }
    const blocked = yield user_1.default.blocks.is(teaser.fromuid, uid);
    if (blocked) {
        return null;
    }
    teaser.user = yield user_1.default.getUserFields(teaser.fromuid, ['uid', 'username', 'userslug', 'picture', 'status', 'lastonline']);
    if (teaser.content) {
        teaser.content = utils.stripHTMLTags(utils.decodeHTMLEntities(teaser.content));
        teaser.content = validator.escape(String(teaser.content));
    }
    const payload = yield plugins.hooks.fire('filter:messaging.getTeaser', { teaser: teaser });
    return payload.teaser;
});
Messaging.getLatestUndeletedMessage = (uid, roomId) => __awaiter(void 0, void 0, void 0, function* () {
    let done = false;
    let latestMid = null;
    let index = 0;
    let mids;
    while (!done) {
        /* eslint-disable no-await-in-loop */
        mids = yield db.getSortedSetRevRange(`uid:${uid}:chat:room:${roomId}:mids`, index, index);
        if (mids.length) {
            const states = yield Messaging.getMessageFields(mids[0], ['deleted', 'system']);
            done = !states.deleted && !states.system;
            if (done) {
                latestMid = mids[0];
            }
            index += 1;
        }
        else {
            done = true;
        }
    }
    return latestMid;
});
Messaging.canMessageUser = (uid, toUid) => __awaiter(void 0, void 0, void 0, function* () {
    if (meta_1.default.config.disableChat || uid <= 0) {
        throw new Error('[[error:chat-disabled]]');
    }
    if (parseInt(uid, 10) === parseInt(toUid, 10)) {
        throw new Error('[[error:cant-chat-with-yourself]]');
    }
    const [exists, canChat] = yield Promise.all([
        user_1.default.exists(toUid),
        privileges.global.can('chat', uid),
        checkReputation(uid),
    ]);
    if (!exists) {
        throw new Error('[[error:no-user]]');
    }
    if (!canChat) {
        throw new Error('[[error:no-privileges]]');
    }
    const [settings, isAdmin, isModerator, isFollowing, isBlocked] = yield Promise.all([
        user_1.default.getSettings(toUid),
        user_1.default.isAdministrator(uid),
        user_1.default.isModeratorOfAnyCategory(uid),
        user_1.default.isFollowing(toUid, uid),
        user_1.default.blocks.is(uid, toUid),
    ]);
    if (isBlocked || (settings.restrictChat && !isAdmin && !isModerator && !isFollowing)) {
        throw new Error('[[error:chat-restricted]]');
    }
    yield plugins.hooks.fire('static:messaging.canMessageUser', {
        uid: uid,
        toUid: toUid,
    });
});
Messaging.canMessageRoom = (uid, roomId) => __awaiter(void 0, void 0, void 0, function* () {
    if (meta_1.default.config.disableChat || uid <= 0) {
        throw new Error('[[error:chat-disabled]]');
    }
    const [inRoom, canChat] = yield Promise.all([
        Messaging.isUserInRoom(uid, roomId),
        privileges.global.can('chat', uid),
        checkReputation(uid),
    ]);
    if (!inRoom) {
        throw new Error('[[error:not-in-room]]');
    }
    if (!canChat) {
        throw new Error('[[error:no-privileges]]');
    }
    yield plugins.hooks.fire('static:messaging.canMessageRoom', {
        uid: uid,
        roomId: roomId,
    });
});
function checkReputation(uid) {
    return __awaiter(this, void 0, void 0, function* () {
        if (meta_1.default.config['min:rep:chat'] > 0) {
            const reputation = yield user_1.default.getUserField(uid, 'reputation');
            if (meta_1.default.config['min:rep:chat'] > reputation) {
                throw new Error(`[[error:not-enough-reputation-to-chat, ${meta_1.default.config['min:rep:chat']}]]`);
            }
        }
    });
}
Messaging.hasPrivateChat = (uid, withUid) => __awaiter(void 0, void 0, void 0, function* () {
    if (parseInt(uid, 10) === parseInt(withUid, 10)) {
        return 0;
    }
    const results = yield utils.promiseParallel({
        myRooms: db.getSortedSetRevRange(`uid:${uid}:chat:rooms`, 0, -1),
        theirRooms: db.getSortedSetRevRange(`uid:${withUid}:chat:rooms`, 0, -1),
    });
    const roomIds = results.myRooms.filter(roomId => roomId && results.theirRooms.includes(roomId));
    if (!roomIds.length) {
        return 0;
    }
    let index = 0;
    let roomId = 0;
    while (index < roomIds.length && !roomId) {
        /* eslint-disable no-await-in-loop */
        const count = yield Messaging.getUserCountInRoom(roomIds[index]);
        if (count === 2) {
            roomId = roomIds[index];
        }
        else {
            index += 1;
        }
    }
    return roomId;
});
Messaging.canViewMessage = (mids, roomId, uid) => __awaiter(void 0, void 0, void 0, function* () {
    let single = false;
    if (!Array.isArray(mids) && isFinite(mids)) {
        mids = [mids];
        single = true;
    }
    const canView = yield db.isSortedSetMembers(`uid:${uid}:chat:room:${roomId}:mids`, mids);
    return single ? canView.pop() : canView;
});
require('../promisify').promisify(Messaging);
