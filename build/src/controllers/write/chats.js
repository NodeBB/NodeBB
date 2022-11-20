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
const api_1 = __importDefault(require("../../api"));
const messaging = require('../../messaging');
const helpers_1 = __importDefault(require("../helpers"));
const Chats = {};
Chats.list = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const page = (isFinite(req.query.page) && parseInt(req.query.page, 10)) || 1;
    const perPage = (isFinite(req.query.perPage) && parseInt(req.query.perPage, 10)) || 20;
    const start = Math.max(0, page - 1) * perPage;
    const stop = start + perPage;
    const { rooms } = yield messaging.getRecentChats(req.uid, req.uid, start, stop);
    helpers_1.default.formatApiResponse(200, res, { rooms });
});
Chats.create = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const roomObj = yield api_1.default.chats.create(req, req.body);
    helpers_1.default.formatApiResponse(200, res, roomObj);
});
Chats.exists = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    helpers_1.default.formatApiResponse(200, res);
});
Chats.get = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const roomObj = yield messaging.loadRoom(req.uid, {
        uid: req.query.uid || req.uid,
        roomId: req.params.roomId,
    });
    helpers_1.default.formatApiResponse(200, res, roomObj);
});
Chats.post = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const messageObj = yield api_1.default.chats.post(req, Object.assign(Object.assign({}, req.body), { roomId: req.params.roomId }));
    helpers_1.default.formatApiResponse(200, res, messageObj);
});
Chats.rename = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const roomObj = yield api_1.default.chats.rename(req, Object.assign(Object.assign({}, req.body), { roomId: req.params.roomId }));
    helpers_1.default.formatApiResponse(200, res, roomObj);
});
Chats.users = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const users = yield api_1.default.chats.users(req, Object.assign({}, req.params));
    helpers_1.default.formatApiResponse(200, res, users);
});
Chats.invite = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const users = yield api_1.default.chats.invite(req, Object.assign(Object.assign({}, req.body), { roomId: req.params.roomId }));
    helpers_1.default.formatApiResponse(200, res, users);
});
Chats.kick = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const users = yield api_1.default.chats.kick(req, Object.assign(Object.assign({}, req.body), { roomId: req.params.roomId }));
    helpers_1.default.formatApiResponse(200, res, users);
});
Chats.kickUser = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    req.body.uids = [req.params.uid];
    const users = yield api_1.default.chats.kick(req, Object.assign(Object.assign({}, req.body), { roomId: req.params.roomId }));
    helpers_1.default.formatApiResponse(200, res, users);
});
Chats.messages = {};
Chats.messages.list = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const messages = yield messaging.getMessages({
        callerUid: req.uid,
        uid: req.query.uid || req.uid,
        roomId: req.params.roomId,
        start: parseInt(req.query.start, 10) || 0,
        count: 50,
    });
    helpers_1.default.formatApiResponse(200, res, { messages });
});
Chats.messages.get = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const messages = yield messaging.getMessagesData([req.params.mid], req.uid, req.params.roomId, false);
    helpers_1.default.formatApiResponse(200, res, messages.pop());
});
Chats.messages.edit = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    yield messaging.canEdit(req.params.mid, req.uid);
    yield messaging.editMessage(req.uid, req.params.mid, req.params.roomId, req.body.message);
    const messages = yield messaging.getMessagesData([req.params.mid], req.uid, req.params.roomId, false);
    helpers_1.default.formatApiResponse(200, res, messages.pop());
});
Chats.messages.delete = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    yield messaging.canDelete(req.params.mid, req.uid);
    yield messaging.deleteMessage(req.params.mid, req.uid);
    helpers_1.default.formatApiResponse(200, res);
});
Chats.messages.restore = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    yield messaging.canDelete(req.params.mid, req.uid);
    yield messaging.restoreMessage(req.params.mid, req.uid);
    helpers_1.default.formatApiResponse(200, res);
});
