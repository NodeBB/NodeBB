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
const topics = require('../topics');
const plugins = require('../plugins');
const meta_1 = __importDefault(require("../meta"));
function default_1(User) {
    User.updateLastOnlineTime = function (uid) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!(parseInt(uid, 10) > 0)) {
                return;
            }
            const userData = yield database_1.default.getObjectFields(`user:${uid}`, ['status', 'lastonline']);
            const now = Date.now();
            if (userData.status === 'offline' || now - parseInt(userData.lastonline, 10) < 300000) {
                return;
            }
            yield User.setUserField(uid, 'lastonline', now);
        });
    };
    User.updateOnlineUsers = function (uid) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!(parseInt(uid, 10) > 0)) {
                return;
            }
            const now = Date.now();
            const userOnlineTime = yield database_1.default.sortedSetScore('users:online', uid);
            if (now - parseInt(userOnlineTime, 10) < 300000) {
                return;
            }
            yield database_1.default.sortedSetAdd('users:online', now, uid);
            topics.pushUnreadCount(uid);
            plugins.hooks.fire('action:user.online', { uid: uid, timestamp: now });
        });
    };
    User.isOnline = function (uid) {
        return __awaiter(this, void 0, void 0, function* () {
            const now = Date.now();
            const isArray = Array.isArray(uid);
            uid = isArray ? uid : [uid];
            const lastonline = yield database_1.default.sortedSetScores('users:online', uid);
            const isOnline = uid.map((uid, index) => (now - lastonline[index]) < (meta_1.default.config.onlineCutoff * 60000));
            return isArray ? isOnline : isOnline[0];
        });
    };
}
exports.default = default_1;
;
