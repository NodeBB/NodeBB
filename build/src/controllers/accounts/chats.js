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
const messaging = require('../../messaging');
const meta_1 = __importDefault(require("../../meta"));
const user_1 = __importDefault(require("../../user"));
const privileges = require('../../privileges');
const helpers_1 = __importDefault(require("../helpers"));
const chatsController = {};
chatsController.get = function (req, res, next) {
    return __awaiter(this, void 0, void 0, function* () {
        if (meta_1.default.config.disableChat) {
            return next();
        }
        const uid = yield user_1.default.getUidByUserslug(req.params.userslug);
        if (!uid) {
            return next();
        }
        const canChat = yield privileges.global.can('chat', req.uid);
        if (!canChat) {
            return next(new Error('[[error:no-privileges]]'));
        }
        const recentChats = yield messaging.getRecentChats(req.uid, uid, 0, 19);
        if (!recentChats) {
            return next();
        }
        if (!req.params.roomid) {
            return res.render('chats', {
                rooms: recentChats.rooms,
                uid: uid,
                userslug: req.params.userslug,
                nextStart: recentChats.nextStart,
                allowed: true,
                title: '[[pages:chats]]',
            });
        }
        const room = yield messaging.loadRoom(req.uid, { uid: uid, roomId: req.params.roomid });
        if (!room) {
            return next();
        }
        room.rooms = recentChats.rooms;
        room.nextStart = recentChats.nextStart;
        room.title = room.roomName || room.usernames || '[[pages:chats]]';
        room.uid = uid;
        room.userslug = req.params.userslug;
        room.canViewInfo = yield privileges.global.can('view:users:info', uid);
        res.render('chats', room);
    });
};
chatsController.redirectToChat = function (req, res, next) {
    return __awaiter(this, void 0, void 0, function* () {
        if (!req.loggedIn) {
            return next();
        }
        const userslug = yield user_1.default.getUserField(req.uid, 'userslug');
        if (!userslug) {
            return next();
        }
        const roomid = parseInt(req.params.roomid, 10);
        helpers_1.default.redirect(res, `/user/${userslug}/chats${roomid ? `/${roomid}` : ''}`);
    });
};
