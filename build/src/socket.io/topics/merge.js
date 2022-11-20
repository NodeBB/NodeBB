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
const topics = require('../../topics');
const privileges = require('../../privileges');
const events = require('../../events');
function default_1(SocketTopics) {
    SocketTopics.merge = function (socket, data) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!data || !Array.isArray(data.tids)) {
                throw new Error('[[error:invalid-data]]');
            }
            const allowed = yield Promise.all(data.tids.map(tid => privileges.topics.isAdminOrMod(tid, socket.uid)));
            if (allowed.includes(false)) {
                throw new Error('[[error:no-privileges]]');
            }
            if (data.options && data.options.mainTid && !data.tids.includes(data.options.mainTid)) {
                throw new Error('[[error:invalid-data]]');
            }
            const mergeIntoTid = yield topics.merge(data.tids, socket.uid, data.options);
            yield events.log({
                type: `topic-merge`,
                uid: socket.uid,
                ip: socket.ip,
                mergeIntoTid: mergeIntoTid,
                tids: String(data.tids),
            });
            return mergeIntoTid;
        });
    };
}
exports.default = default_1;
;
