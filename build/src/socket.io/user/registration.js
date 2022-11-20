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
const events = require('../../events');
function default_1(SocketUser) {
    SocketUser.acceptRegistration = function (socket, data) {
        return __awaiter(this, void 0, void 0, function* () {
            const isAdminOrGlobalMod = yield user_1.default.isAdminOrGlobalMod(socket.uid);
            if (!isAdminOrGlobalMod) {
                throw new Error('[[error:no-privileges]]');
            }
            const uid = yield user_1.default.acceptRegistration(data.username);
            yield events.log({
                type: 'registration-approved',
                uid: socket.uid,
                ip: socket.ip,
                targetUid: uid,
            });
            return uid;
        });
    };
    SocketUser.rejectRegistration = function (socket, data) {
        return __awaiter(this, void 0, void 0, function* () {
            const isAdminOrGlobalMod = yield user_1.default.isAdminOrGlobalMod(socket.uid);
            if (!isAdminOrGlobalMod) {
                throw new Error('[[error:no-privileges]]');
            }
            yield user_1.default.rejectRegistration(data.username);
            yield events.log({
                type: 'registration-rejected',
                uid: socket.uid,
                ip: socket.ip,
                username: data.username,
            });
        });
    };
    SocketUser.deleteInvitation = function (socket, data) {
        return __awaiter(this, void 0, void 0, function* () {
            const isAdminOrGlobalMod = yield user_1.default.isAdminOrGlobalMod(socket.uid);
            if (!isAdminOrGlobalMod) {
                throw new Error('[[error:no-privileges]]');
            }
            yield user_1.default.deleteInvitation(data.invitedBy, data.email);
        });
    };
}
exports.default = default_1;
;
