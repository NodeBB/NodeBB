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
const plugins = require('../../plugins');
function default_1(SocketUser) {
    SocketUser.removeUploadedPicture = function (socket, data) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!socket.uid || !data || !data.uid) {
                throw new Error('[[error:invalid-data]]');
            }
            yield user_1.default.isAdminOrSelf(socket.uid, data.uid);
            // 'keepAllUserImages' is ignored, since there is explicit user intent
            const userData = yield user_1.default.removeProfileImage(data.uid);
            plugins.hooks.fire('action:user.removeUploadedPicture', {
                callerUid: socket.uid,
                uid: data.uid,
                user: userData,
            });
        });
    };
    SocketUser.getProfilePictures = function (socket, data) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!data || !data.uid) {
                throw new Error('[[error:invalid-data]]');
            }
            const [list, userObj] = yield Promise.all([
                plugins.hooks.fire('filter:user.listPictures', {
                    uid: data.uid,
                    pictures: [],
                }),
                user_1.default.getUserData(data.uid),
            ]);
            if (userObj.uploadedpicture) {
                list.pictures.push({
                    type: 'uploaded',
                    url: userObj.uploadedpicture,
                    text: '[[user:uploaded_picture]]',
                });
            }
            // Normalize list into "user object" format
            list.pictures = list.pictures.map(({ type, url, text }) => ({
                type,
                username: text,
                picture: url,
            }));
            list.pictures.unshift({
                type: 'default',
                'icon:text': userObj['icon:text'],
                'icon:bgColor': userObj['icon:bgColor'],
                username: '[[user:default_picture]]',
            });
            return list.pictures;
        });
    };
}
exports.default = default_1;
;
