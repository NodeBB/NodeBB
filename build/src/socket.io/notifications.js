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
const user_1 = __importDefault(require("../user"));
const notifications = require('../notifications');
const SocketNotifs = {};
SocketNotifs.get = function (socket, data) {
    return __awaiter(this, void 0, void 0, function* () {
        if (data && Array.isArray(data.nids) && socket.uid) {
            return yield user_1.default.notifications.getNotifications(data.nids, socket.uid);
        }
        return yield user_1.default.notifications.get(socket.uid);
    });
};
SocketNotifs.getCount = function (socket) {
    return __awaiter(this, void 0, void 0, function* () {
        return yield user_1.default.notifications.getUnreadCount(socket.uid);
    });
};
SocketNotifs.deleteAll = function (socket) {
    return __awaiter(this, void 0, void 0, function* () {
        if (!socket.uid) {
            throw new Error('[[error:no-privileges]]');
        }
        yield user_1.default.notifications.deleteAll(socket.uid);
    });
};
SocketNotifs.markRead = function (socket, nid) {
    return __awaiter(this, void 0, void 0, function* () {
        yield notifications.markRead(nid, socket.uid);
        user_1.default.notifications.pushCount(socket.uid);
    });
};
SocketNotifs.markUnread = function (socket, nid) {
    return __awaiter(this, void 0, void 0, function* () {
        yield notifications.markUnread(nid, socket.uid);
        user_1.default.notifications.pushCount(socket.uid);
    });
};
SocketNotifs.markAllRead = function (socket) {
    return __awaiter(this, void 0, void 0, function* () {
        yield notifications.markAllRead(socket.uid);
        user_1.default.notifications.pushCount(socket.uid);
    });
};
require('../promisify').promisify(SocketNotifs);
