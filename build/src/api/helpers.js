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
exports.postCommand = exports.doTopicAction = exports.buildReqObject = exports.setDefaultPostData = void 0;
const url = require('url');
const user_1 = __importDefault(require("../user"));
const topics = require('../topics');
const posts = require('../posts');
const privileges = require('../privileges');
const plugins = require('../plugins');
const socketHelpers = require('../socket.io/helpers');
const websockets = require('../socket.io');
const events = require('../events');
const setDefaultPostData = function (reqOrSocket, data) {
    data.uid = reqOrSocket.uid;
    data.req = (0, exports.buildReqObject)(reqOrSocket, Object.assign({}, data));
    data.timestamp = Date.now();
    data.fromQueue = false;
};
exports.setDefaultPostData = setDefaultPostData;
// creates a slimmed down version of the request object
const buildReqObject = (req, payload) => {
    req = req || {};
    const headers = req.headers || (req.request && req.request.headers) || {};
    const encrypted = req.connection ? !!req.connection.encrypted : false;
    let { host } = headers;
    const referer = headers.referer || '';
    if (!host) {
        host = url.parse(referer).host || '';
    }
    return {
        uid: req.uid,
        params: req.params,
        method: req.method,
        body: payload || req.body,
        session: req.session,
        ip: req.ip,
        host: host,
        protocol: encrypted ? 'https' : 'http',
        secure: encrypted,
        url: referer,
        path: referer.slice(referer.indexOf(host) + host.length),
        headers: headers,
    };
};
exports.buildReqObject = buildReqObject;
const doTopicAction = function (action, event, caller, { tids }) {
    return __awaiter(this, void 0, void 0, function* () {
        if (!Array.isArray(tids)) {
            throw new Error('[[error:invalid-tid]]');
        }
        const exists = yield topics.exists(tids);
        if (!exists.every(Boolean)) {
            throw new Error('[[error:no-topic]]');
        }
        if (typeof topics.tools[action] !== 'function') {
            return;
        }
        const uids = yield user_1.default.getUidsFromSet('users:online', 0, -1);
        yield Promise.all(tids.map((tid) => __awaiter(this, void 0, void 0, function* () {
            const title = yield topics.getTopicField(tid, 'title');
            const data = yield topics.tools[action](tid, caller.uid);
            const notifyUids = yield privileges.categories.filterUids('topics:read', data.cid, uids);
            socketHelpers.emitToUids(event, data, notifyUids);
            yield logTopicAction(action, caller, tid, title);
        })));
    });
};
exports.doTopicAction = doTopicAction;
function logTopicAction(action, req, tid, title) {
    return __awaiter(this, void 0, void 0, function* () {
        // Only log certain actions to system event log
        const actionsToLog = ['delete', 'restore', 'purge'];
        if (!actionsToLog.includes(action)) {
            return;
        }
        yield events.log({
            type: `topic-${action}`,
            uid: req.uid,
            ip: req.ip,
            tid: tid,
            title: String(title),
        });
    });
}
const postCommand = function (caller, command, eventName, notification, data) {
    return __awaiter(this, void 0, void 0, function* () {
        if (!caller.uid) {
            throw new Error('[[error:not-logged-in]]');
        }
        if (!data || !data.pid) {
            throw new Error('[[error:invalid-data]]');
        }
        if (!data.room_id) {
            throw new Error(`[[error:invalid-room-id, ${data.room_id} ]]`);
        }
        const [exists, deleted] = yield Promise.all([
            posts.exists(data.pid),
            posts.getPostField(data.pid, 'deleted'),
        ]);
        if (!exists) {
            throw new Error('[[error:invalid-pid]]');
        }
        if (deleted) {
            throw new Error('[[error:post-deleted]]');
        }
        /*
        hooks:
            filter:post.upvote
            filter:post.downvote
            filter:post.unvote
            filter:post.bookmark
            filter:post.unbookmark
         */
        const filteredData = yield plugins.hooks.fire(`filter:post.${command}`, {
            data: data,
            uid: caller.uid,
        });
        return yield executeCommand(caller, command, eventName, notification, filteredData.data);
    });
};
exports.postCommand = postCommand;
function executeCommand(caller, command, eventName, notification, data) {
    return __awaiter(this, void 0, void 0, function* () {
        const result = yield posts[command](data.pid, caller.uid);
        if (result && eventName) {
            websockets.in(`uid_${caller.uid}`).emit(`posts.${command}`, result);
            websockets.in(data.room_id).emit(`event:${eventName}`, result);
        }
        if (result && command === 'upvote') {
            socketHelpers.upvote(result, notification);
        }
        else if (result && notification) {
            socketHelpers.sendNotificationToPostOwner(data.pid, caller.uid, command, notification);
        }
        else if (result && command === 'unvote') {
            socketHelpers.rescindUpvoteNotification(data.pid, caller.uid);
        }
        return result;
    });
}
