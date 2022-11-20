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
const sockets = require('../socket.io');
function default_1(Messaging) {
    Messaging.getUnreadCount = (uid) => __awaiter(this, void 0, void 0, function* () {
        if (parseInt(uid, 10) <= 0) {
            return 0;
        }
        return yield database_1.default.sortedSetCard(`uid:${uid}:chat:rooms:unread`);
    });
    Messaging.pushUnreadCount = (uid) => __awaiter(this, void 0, void 0, function* () {
        if (parseInt(uid, 10) <= 0) {
            return;
        }
        const unreadCount = yield Messaging.getUnreadCount(uid);
        sockets.in(`uid_${uid}`).emit('event:unread.updateChatCount', unreadCount);
    });
    Messaging.markRead = (uid, roomId) => __awaiter(this, void 0, void 0, function* () {
        yield database_1.default.sortedSetRemove(`uid:${uid}:chat:rooms:unread`, roomId);
    });
    Messaging.markAllRead = (uid) => __awaiter(this, void 0, void 0, function* () {
        yield database_1.default.delete(`uid:${uid}:chat:rooms:unread`);
    });
    Messaging.markUnread = (uids, roomId) => __awaiter(this, void 0, void 0, function* () {
        const exists = yield Messaging.roomExists(roomId);
        if (!exists) {
            return;
        }
        const keys = uids.map(uid => `uid:${uid}:chat:rooms:unread`);
        return yield database_1.default.sortedSetsAdd(keys, Date.now(), roomId);
    });
}
exports.default = default_1;
;
