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
const os = require('os');
const nconf_1 = __importDefault(require("nconf"));
const winston_1 = __importDefault(require("winston"));
const util = require('util');
const validator = require('validator');
const cookieParser = require('cookie-parser')(nconf_1.default.get('secret'));
const database = __importStar(require("../database"));
const db = database;
const user_1 = __importDefault(require("../user"));
const meta_1 = __importDefault(require("../meta"));
const logger = require('../logger');
const plugins = require('../plugins');
const ratelimit = require('../middleware/ratelimit');
const Namespaces = {};
const Sockets = {};
Sockets.init = function (server) {
    return __awaiter(this, void 0, void 0, function* () {
        requireModules();
        const SocketIO = require('socket.io').Server;
        const io = new SocketIO({
            path: `${nconf_1.default.get('relative_path')}/socket.io`,
        });
        if (nconf_1.default.get('isCluster')) {
            if (nconf_1.default.get('redis')) {
                const adapter = yield require('../database/redis').socketAdapter();
                io.adapter(adapter);
            }
            else {
                winston_1.default.warn('clustering detected, you should setup redis!');
            }
        }
        io.use(authorize);
        io.on('connection', onConnection);
        const opts = {
            transports: nconf_1.default.get('socket.io:transports') || ['polling', 'websocket'],
            cookie: false,
        };
        /*
         * Restrict socket.io listener to cookie domain. If none is set, infer based on url.
         * Production only so you don't get accidentally locked out.
         * Can be overridden via config (socket.io:origins)
         */
        if (process.env.NODE_ENV !== 'development' || nconf_1.default.get('socket.io:cors')) {
            const origins = nconf_1.default.get('socket.io:origins');
            opts.cors = nconf_1.default.get('socket.io:cors') || {
                origin: origins,
                methods: ['GET', 'POST'],
                allowedHeaders: ['content-type'],
            };
            winston_1.default.info(`[socket.io] Restricting access to origin: ${origins}`);
        }
        io.listen(server, opts);
        Sockets.server = io;
    });
};
function onConnection(socket) {
    socket.ip = (socket.request.headers['x-forwarded-for'] || socket.request.connection.remoteAddress || '').split(',')[0];
    socket.request.ip = socket.ip;
    logger.io_one(socket, socket.uid);
    onConnect(socket);
    socket.onAny((event, ...args) => {
        const payload = { data: [event].concat(args) };
        const als = require('../als');
        als.run({ uid: socket.uid }, onMessage, socket, payload);
    });
    socket.on('disconnect', () => {
        onDisconnect(socket);
    });
}
function onDisconnect(socket) {
    require('./uploads').clear(socket.id);
    plugins.hooks.fire('action:sockets.disconnect', { socket: socket });
}
function onConnect(socket) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            yield validateSession(socket, '[[error:invalid-session]]');
        }
        catch (e) {
            if (e.message === '[[error:invalid-session]]') {
                socket.emit('event:invalid_session');
            }
            return;
        }
        if (socket.uid) {
            socket.join(`uid_${socket.uid}`);
            socket.join('online_users');
        }
        else {
            socket.join('online_guests');
        }
        socket.join(`sess_${socket.request.signedCookies[nconf_1.default.get('sessionKey')]}`);
        socket.emit('checkSession', socket.uid);
        socket.emit('setHostname', os.hostname());
        plugins.hooks.fire('action:sockets.connect', { socket: socket });
    });
}
function onMessage(socket, payload) {
    return __awaiter(this, void 0, void 0, function* () {
        if (!payload.data.length) {
            return winston_1.default.warn('[socket.io] Empty payload');
        }
        const eventName = payload.data[0];
        const params = typeof payload.data[1] === 'function' ? {} : payload.data[1];
        const callback = typeof payload.data[payload.data.length - 1] === 'function' ? payload.data[payload.data.length - 1] : function () { };
        if (!eventName) {
            return winston_1.default.warn('[socket.io] Empty method name');
        }
        const parts = eventName.toString().split('.');
        const namespace = parts[0];
        const methodToCall = parts.reduce((prev, cur) => {
            if (prev !== null && prev[cur]) {
                return prev[cur];
            }
            return null;
        }, Namespaces);
        if (!methodToCall || typeof methodToCall !== 'function') {
            if (process.env.NODE_ENV === 'development') {
                winston_1.default.warn(`[socket.io] Unrecognized message: ${eventName}`);
            }
            const escapedName = validator.escape(String(eventName));
            return callback({ message: `[[error:invalid-event, ${escapedName}]]` });
        }
        socket.previousEvents = socket.previousEvents || [];
        socket.previousEvents.push(eventName);
        if (socket.previousEvents.length > 20) {
            socket.previousEvents.shift();
        }
        if (!eventName.startsWith('admin.') && ratelimit.isFlooding(socket)) {
            winston_1.default.warn(`[socket.io] Too many emits! Disconnecting uid : ${socket.uid}. Events : ${socket.previousEvents}`);
            return socket.disconnect();
        }
        try {
            yield checkMaintenance(socket);
            yield validateSession(socket, '[[error:revalidate-failure]]');
            if (Namespaces[namespace].before) {
                yield Namespaces[namespace].before(socket, eventName, params);
            }
            if (methodToCall.constructor && methodToCall.constructor.name === 'AsyncFunction') {
                const result = yield methodToCall(socket, params);
                callback(null, result);
            }
            else {
                methodToCall(socket, params, (err, result) => {
                    callback(err ? { message: err.message } : null, result);
                });
            }
        }
        catch (err) {
            winston_1.default.error(`${eventName}\n${err.stack ? err.stack : err.message}`);
            callback({ message: err.message });
        }
    });
}
function requireModules() {
    const modules = [
        'admin', 'categories', 'groups', 'meta', 'modules',
        'notifications', 'plugins', 'posts', 'topics', 'user',
        'blacklist', 'uploads',
    ];
    modules.forEach((module) => {
        Namespaces[module] = require(`./${module}`);
    });
}
function checkMaintenance(socket) {
    return __awaiter(this, void 0, void 0, function* () {
        if (!meta_1.default.config.maintenanceMode) {
            return;
        }
        const isAdmin = yield user_1.default.isAdministrator(socket.uid);
        if (isAdmin) {
            return;
        }
        const validator = require('validator');
        throw new Error(`[[pages:maintenance.text, ${validator.escape(String(meta_1.default.config.title || 'NodeBB'))}]]`);
    });
}
const getSessionAsync = util.promisify((sid, callback) => db.sessionStore.get(sid, (err, sessionObj) => callback(err, sessionObj || null)));
function validateSession(socket, errorMsg) {
    return __awaiter(this, void 0, void 0, function* () {
        const req = socket.request;
        const { sessionId } = yield plugins.hooks.fire('filter:sockets.sessionId', {
            sessionId: req.signedCookies ? req.signedCookies[nconf_1.default.get('sessionKey')] : null,
            request: req,
        });
        if (!sessionId) {
            return;
        }
        const sessionData = yield getSessionAsync(sessionId);
        if (!sessionData) {
            throw new Error(errorMsg);
        }
        yield plugins.hooks.fire('static:sockets.validateSession', {
            req: req,
            socket: socket,
            session: sessionData,
        });
    });
}
const cookieParserAsync = util.promisify((req, callback) => cookieParser(req, {}, err => callback(err)));
function authorize(socket, callback) {
    return __awaiter(this, void 0, void 0, function* () {
        const { request } = socket;
        if (!request) {
            return callback(new Error('[[error:not-authorized]]'));
        }
        yield cookieParserAsync(request);
        const { sessionId } = yield plugins.hooks.fire('filter:sockets.sessionId', {
            sessionId: request.signedCookies ? request.signedCookies[nconf_1.default.get('sessionKey')] : null,
            request: request,
        });
        const sessionData = yield getSessionAsync(sessionId);
        if (sessionData && sessionData.passport && sessionData.passport.user) {
            request.session = sessionData;
            socket.uid = parseInt(sessionData.passport.user, 10);
        }
        else {
            socket.uid = 0;
        }
        request.uid = socket.uid;
        callback();
    });
}
Sockets.in = function (room) {
    return Sockets.server && Sockets.server.in(room);
};
Sockets.getUserSocketCount = function (uid) {
    return Sockets.getCountInRoom(`uid_${uid}`);
};
Sockets.getCountInRoom = function (room) {
    if (!Sockets.server) {
        return 0;
    }
    const roomMap = Sockets.server.sockets.adapter.rooms.get(room);
    return roomMap ? roomMap.size : 0;
};
Sockets.warnDeprecated = (socket, replacement) => {
    if (socket.previousEvents && socket.emit) {
        socket.emit('event:deprecated_call', {
            eventName: socket.previousEvents[socket.previousEvents.length - 1],
            replacement: replacement,
        });
    }
    // @ts-ignore
    winston_1.default.warn(`[deprecated]\n ${new Error('-').stack.split('\n').slice(2, 5).join('\n')}\n     use ${replacement}`);
};
