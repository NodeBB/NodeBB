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
const user_1 = __importDefault(require("../../user"));
const websockets = require('../index');
function default_1(SocketUser) {
    SocketUser.checkStatus = function (socket, uid) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!socket.uid) {
                throw new Error('[[error:invalid-uid]]');
            }
            const userData = yield user_1.default.getUserFields(uid, ['lastonline', 'status']);
            return user_1.default.getStatus(userData);
        });
    };
    SocketUser.setStatus = function (socket, status) {
        return __awaiter(this, void 0, void 0, function* () {
            if (socket.uid <= 0) {
                throw new Error('[[error:invalid-uid]]');
            }
            const allowedStatus = ['online', 'offline', 'dnd', 'away'];
            if (!allowedStatus.includes(status)) {
                throw new Error('[[error:invalid-user-status]]');
            }
            const userData = { status: status };
            if (status !== 'offline') {
                userData.lastonline = Date.now();
            }
            yield user_1.default.setUserFields(socket.uid, userData);
            if (status !== 'offline') {
                yield user_1.default.updateOnlineUsers(socket.uid);
            }
            const eventData = {
                uid: socket.uid,
                status: status,
            };
            websockets.server.emit('event:user_status_change', eventData);
            return eventData;
        });
    };
}
exports.default = default_1;
;
