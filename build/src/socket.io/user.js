'use strict';
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
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
const util = require('util');
const winston_1 = __importDefault(require("winston"));
const sleep = util.promisify(setTimeout);
const user_1 = __importDefault(require("../user"));
const topics = require('../topics');
const messaging = require('../messaging');
const plugins = require('../plugins');
const meta_1 = __importDefault(require("../meta"));
const events = require('../events');
const emailer = require('../emailer');
const database = __importStar(require("../database"));
const db = database;
const userController = require('../controllers/user');
const privileges = require('../privileges');
const utils = require('../utils');
const SocketUser = {};
require('./user/profile').default(SocketUser);
require('./user/status').default(SocketUser);
require('./user/picture').default(SocketUser);
require('./user/registration').default(SocketUser);
// Password Reset
SocketUser.reset = {};
SocketUser.reset.send = function (socket, email) {
    return __awaiter(this, void 0, void 0, function* () {
        if (!email) {
            throw new Error('[[error:invalid-data]]');
        }
        if (meta_1.default.config['password:disableEdit']) {
            throw new Error('[[error:no-privileges]]');
        }
        function logEvent(text) {
            return __awaiter(this, void 0, void 0, function* () {
                yield events.log({
                    type: 'password-reset',
                    text: text,
                    ip: socket.ip,
                    uid: socket.uid,
                    email: email,
                });
            });
        }
        try {
            yield user_1.default.reset.send(email);
            yield logEvent('[[success:success]]');
            yield sleep(2500 + ((Math.random() * 500) - 250));
        }
        catch (err) {
            yield logEvent(err.message);
            yield sleep(2500 + ((Math.random() * 500) - 250));
            const internalErrors = ['[[error:invalid-email]]', '[[error:reset-rate-limited]]'];
            if (!internalErrors.includes(err.message)) {
                throw err;
            }
        }
    });
};
SocketUser.reset.commit = function (socket, data) {
    return __awaiter(this, void 0, void 0, function* () {
        if (!data || !data.code || !data.password) {
            throw new Error('[[error:invalid-data]]');
        }
        const [uid] = yield Promise.all([
            db.getObjectField('reset:uid', data.code),
            user_1.default.reset.commit(data.code, data.password),
            plugins.hooks.fire('action:password.reset', { uid: socket.uid }),
        ]);
        yield events.log({
            type: 'password-reset',
            uid: uid,
            ip: socket.ip,
        });
        const username = yield user_1.default.getUserField(uid, 'username');
        const now = new Date();
        const parsedDate = `${now.getFullYear()}/${now.getMonth() + 1}/${now.getDate()}`;
        emailer.send('reset_notify', uid, {
            username: username,
            date: parsedDate,
            subject: '[[email:reset.notify.subject]]',
        }).catch(err => winston_1.default.error(`[emailer.send] ${err.stack}`));
    });
};
SocketUser.isFollowing = function (socket, data) {
    return __awaiter(this, void 0, void 0, function* () {
        if (!socket.uid || !data.uid) {
            return false;
        }
        return yield user_1.default.isFollowing(socket.uid, data.uid);
    });
};
SocketUser.getUnreadCount = function (socket) {
    return __awaiter(this, void 0, void 0, function* () {
        if (!socket.uid) {
            return 0;
        }
        return yield topics.getTotalUnread(socket.uid, '');
    });
};
SocketUser.getUnreadChatCount = function (socket) {
    return __awaiter(this, void 0, void 0, function* () {
        if (!socket.uid) {
            return 0;
        }
        return yield messaging.getUnreadCount(socket.uid);
    });
};
SocketUser.getUnreadCounts = function (socket) {
    return __awaiter(this, void 0, void 0, function* () {
        if (!socket.uid) {
            return {};
        }
        const results = yield utils.promiseParallel({
            unreadCounts: topics.getUnreadTids({ uid: socket.uid, count: true }),
            unreadChatCount: messaging.getUnreadCount(socket.uid),
            unreadNotificationCount: user_1.default.notifications.getUnreadCount(socket.uid),
        });
        results.unreadTopicCount = results.unreadCounts[''];
        results.unreadNewTopicCount = results.unreadCounts.new;
        results.unreadWatchedTopicCount = results.unreadCounts.watched;
        results.unreadUnrepliedTopicCount = results.unreadCounts.unreplied;
        return results;
    });
};
SocketUser.getUserByUID = function (socket, uid) {
    return __awaiter(this, void 0, void 0, function* () {
        return yield userController.getUserDataByField(socket.uid, 'uid', uid);
    });
};
SocketUser.getUserByUsername = function (socket, username) {
    return __awaiter(this, void 0, void 0, function* () {
        return yield userController.getUserDataByField(socket.uid, 'username', username);
    });
};
SocketUser.getUserByEmail = function (socket, email) {
    return __awaiter(this, void 0, void 0, function* () {
        return yield userController.getUserDataByField(socket.uid, 'email', email);
    });
};
SocketUser.setModerationNote = function (socket, data) {
    return __awaiter(this, void 0, void 0, function* () {
        if (!socket.uid || !data || !data.uid || !data.note) {
            throw new Error('[[error:invalid-data]]');
        }
        const noteData = {
            uid: socket.uid,
            note: data.note,
            timestamp: Date.now(),
        };
        let canEdit = yield privileges.users.canEdit(socket.uid, data.uid);
        if (!canEdit) {
            canEdit = yield user_1.default.isModeratorOfAnyCategory(socket.uid);
        }
        if (!canEdit) {
            throw new Error('[[error:no-privileges]]');
        }
        yield user_1.default.appendModerationNote({ uid: data.uid, noteData });
    });
};
SocketUser.deleteUpload = function (socket, data) {
    return __awaiter(this, void 0, void 0, function* () {
        if (!data || !data.name || !data.uid) {
            throw new Error('[[error:invalid-data]]');
        }
        yield user_1.default.deleteUpload(socket.uid, data.uid, data.name);
    });
};
SocketUser.gdpr = {};
SocketUser.gdpr.consent = function (socket) {
    return __awaiter(this, void 0, void 0, function* () {
        yield user_1.default.setUserField(socket.uid, 'gdpr_consent', 1);
    });
};
SocketUser.gdpr.check = function (socket, data) {
    return __awaiter(this, void 0, void 0, function* () {
        const isAdmin = yield user_1.default.isAdministrator(socket.uid);
        if (!isAdmin) {
            data.uid = socket.uid;
        }
        return yield db.getObjectField(`user:${data.uid}`, 'gdpr_consent');
    });
};
require('../promisify').promisify(SocketUser);
