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
const winston_1 = __importDefault(require("winston"));
const meta_1 = __importDefault(require("../meta"));
const user_1 = __importDefault(require("../user"));
const events = require('../events');
const database_1 = __importDefault(require("../database"));
const privileges = require('../privileges');
const websockets = require('./index');
const index = require('./index');
const getAdminSearchDict = require('../admin/search').getDictionary;
const SocketAdmin = {};
SocketAdmin.user = require('./admin/user');
SocketAdmin.categories = require('./admin/categories');
SocketAdmin.settings = require('./admin/settings');
SocketAdmin.tags = require('./admin/tags');
SocketAdmin.rewards = require('./admin/rewards');
SocketAdmin.navigation = require('./admin/navigation');
SocketAdmin.rooms = require('./admin/rooms');
SocketAdmin.social = require('./admin/social');
SocketAdmin.themes = require('./admin/themes');
SocketAdmin.plugins = require('./admin/plugins');
SocketAdmin.widgets = require('./admin/widgets');
SocketAdmin.config = require('./admin/config');
SocketAdmin.settings = require('./admin/settings');
SocketAdmin.email = require('./admin/email');
SocketAdmin.analytics = require('./admin/analytics');
SocketAdmin.logs = require('./admin/logs');
SocketAdmin.errors = require('./admin/errors');
SocketAdmin.digest = require('./admin/digest');
SocketAdmin.cache = require('./admin/cache');
SocketAdmin.before = function (socket, method) {
    return __awaiter(this, void 0, void 0, function* () {
        const isAdmin = yield user_1.default.isAdministrator(socket.uid);
        if (isAdmin) {
            return;
        }
        // Check admin privileges mapping (if not in mapping, deny access)
        const privilegeSet = privileges.admin.socketMap.hasOwnProperty(method) ? privileges.admin.socketMap[method].split(';') : [];
        const hasPrivilege = (yield Promise.all(privilegeSet.map((privilege) => __awaiter(this, void 0, void 0, function* () { return privileges.admin.can(privilege, socket.uid); })))).some(Boolean);
        if (privilegeSet.length && hasPrivilege) {
            return;
        }
        winston_1.default.warn(`[socket.io] Call to admin method ( ${method} ) blocked (accessed by uid ${socket.uid})`);
        throw new Error('[[error:no-privileges]]');
    });
};
SocketAdmin.restart = function (socket) {
    return __awaiter(this, void 0, void 0, function* () {
        yield logRestart(socket);
        meta_1.default.restart();
    });
};
function logRestart(socket) {
    return __awaiter(this, void 0, void 0, function* () {
        yield events.log({
            type: 'restart',
            uid: socket.uid,
            ip: socket.ip,
        });
        yield database_1.default.setObject('lastrestart', {
            uid: socket.uid,
            ip: socket.ip,
            timestamp: Date.now(),
        });
    });
}
SocketAdmin.reload = function (socket) {
    return __awaiter(this, void 0, void 0, function* () {
        yield require('../meta/build').buildAll();
        yield events.log({
            type: 'build',
            uid: socket.uid,
            ip: socket.ip,
        });
        yield logRestart(socket);
        meta_1.default.restart();
    });
};
SocketAdmin.fireEvent = function (socket, data, callback) {
    index.server.emit(data.name, data.payload || {});
    callback();
};
SocketAdmin.deleteEvents = function (socket, eids, callback) {
    events.deleteEvents(eids, callback);
};
SocketAdmin.deleteAllEvents = function (socket, data, callback) {
    events.deleteAll(callback);
};
SocketAdmin.getSearchDict = function (socket) {
    return __awaiter(this, void 0, void 0, function* () {
        const settings = yield user_1.default.getSettings(socket.uid);
        const lang = settings.userLang || meta_1.default.config.defaultLang || 'en-GB';
        return yield getAdminSearchDict(lang);
    });
};
SocketAdmin.deleteAllSessions = function (socket, data, callback) {
    user_1.default.auth.deleteAllSessions(callback);
};
SocketAdmin.reloadAllSessions = function (socket, data, callback) {
    websockets.in(`uid_${socket.uid}`).emit('event:livereload');
    callback();
};
SocketAdmin.getServerTime = function (socket, data, callback) {
    const now = new Date();
    callback(null, {
        timestamp: now.getTime(),
        offset: now.getTimezoneOffset(),
    });
};
require('../promisify').promisify(SocketAdmin);
