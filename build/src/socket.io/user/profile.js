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
const privileges = require('../../privileges');
const plugins = require('../../plugins');
function default_1(SocketUser) {
    SocketUser.updateCover = function (socket, data) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!socket.uid) {
                throw new Error('[[error:no-privileges]]');
            }
            yield user_1.default.isAdminOrGlobalModOrSelf(socket.uid, data.uid);
            yield user_1.default.checkMinReputation(socket.uid, data.uid, 'min:rep:cover-picture');
            return yield user_1.default.updateCoverPicture(data);
        });
    };
    SocketUser.uploadCroppedPicture = function (socket, data) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!socket.uid || !(yield privileges.users.canEdit(socket.uid, data.uid))) {
                throw new Error('[[error:no-privileges]]');
            }
            yield user_1.default.checkMinReputation(socket.uid, data.uid, 'min:rep:profile-picture');
            data.callerUid = socket.uid;
            return yield user_1.default.uploadCroppedPicture(data);
        });
    };
    SocketUser.removeCover = function (socket, data) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!socket.uid) {
                throw new Error('[[error:no-privileges]]');
            }
            yield user_1.default.isAdminOrGlobalModOrSelf(socket.uid, data.uid);
            const userData = yield user_1.default.getUserFields(data.uid, ['cover:url']);
            // 'keepAllUserImages' is ignored, since there is explicit user intent
            yield user_1.default.removeCoverPicture(data);
            plugins.hooks.fire('action:user.removeCoverPicture', {
                callerUid: socket.uid,
                uid: data.uid,
                user: userData,
            });
        });
    };
    SocketUser.toggleBlock = function (socket, data) {
        return __awaiter(this, void 0, void 0, function* () {
            const isBlocked = yield user_1.default.blocks.is(data.blockeeUid, data.blockerUid);
            yield user_1.default.blocks.can(socket.uid, data.blockerUid, data.blockeeUid, isBlocked ? 'unblock' : 'block');
            yield user_1.default.blocks[isBlocked ? 'remove' : 'add'](data.blockeeUid, data.blockerUid);
            return !isBlocked;
        });
    };
}
exports.default = default_1;
;
