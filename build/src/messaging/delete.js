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
Object.defineProperty(exports, "__esModule", { value: true });
const sockets = require('../socket.io');
function default_1(Messaging) {
    Messaging.deleteMessage = (mid, uid) => __awaiter(this, void 0, void 0, function* () { return yield doDeleteRestore(mid, 1, uid); });
    Messaging.restoreMessage = (mid, uid) => __awaiter(this, void 0, void 0, function* () { return yield doDeleteRestore(mid, 0, uid); });
    function doDeleteRestore(mid, state, uid) {
        return __awaiter(this, void 0, void 0, function* () {
            const field = state ? 'deleted' : 'restored';
            const { deleted, roomId } = yield Messaging.getMessageFields(mid, ['deleted', 'roomId']);
            if (deleted === state) {
                throw new Error(`[[error:chat-${field}-already]]`);
            }
            yield Messaging.setMessageField(mid, 'deleted', state);
            const [uids, messages] = yield Promise.all([
                Messaging.getUidsInRoom(roomId, 0, -1),
                Messaging.getMessagesData([mid], uid, roomId, true),
            ]);
            uids.forEach((_uid) => {
                if (parseInt(_uid, 10) !== parseInt(uid, 10)) {
                    if (state === 1) {
                        sockets.in(`uid_${_uid}`).emit('event:chats.delete', mid);
                    }
                    else if (state === 0) {
                        sockets.in(`uid_${_uid}`).emit('event:chats.restore', messages[0]);
                    }
                }
            });
        });
    }
}
exports.default = default_1;
;
