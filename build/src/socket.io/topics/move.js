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
const async = require('async');
const user_1 = __importDefault(require("../../user"));
const topics = require('../../topics');
const categories_1 = __importDefault(require("../../categories"));
const privileges = require('../../privileges');
const socketHelpers = require('../helpers').defualt;
const events = require('../../events');
function default_1(SocketTopics) {
    SocketTopics.move = function (socket, data) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!data || !Array.isArray(data.tids) || !data.cid) {
                throw new Error('[[error:invalid-data]]');
            }
            const canMove = yield privileges.categories.isAdminOrMod(data.cid, socket.uid);
            if (!canMove) {
                throw new Error('[[error:no-privileges]]');
            }
            const uids = yield user_1.default.getUidsFromSet('users:online', 0, -1);
            yield async.eachLimit(data.tids, 10, (tid) => __awaiter(this, void 0, void 0, function* () {
                const canMove = yield privileges.topics.isAdminOrMod(tid, socket.uid);
                if (!canMove) {
                    throw new Error('[[error:no-privileges]]');
                }
                const topicData = yield topics.getTopicFields(tid, ['tid', 'cid', 'slug', 'deleted']);
                data.uid = socket.uid;
                yield topics.tools.move(tid, data);
                const notifyUids = yield privileges.categories.filterUids('topics:read', topicData.cid, uids);
                socketHelpers.emitToUids('event:topic_moved', topicData, notifyUids);
                if (!topicData.deleted) {
                    socketHelpers.sendNotificationToTopicOwner(tid, socket.uid, 'move', 'notifications:moved_your_topic');
                }
                yield events.log({
                    type: `topic-move`,
                    uid: socket.uid,
                    ip: socket.ip,
                    tid: tid,
                    fromCid: topicData.cid,
                    toCid: data.cid,
                });
            }));
        });
    };
    SocketTopics.moveAll = function (socket, data) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!data || !data.cid || !data.currentCid) {
                throw new Error('[[error:invalid-data]]');
            }
            const canMove = yield privileges.categories.canMoveAllTopics(data.currentCid, data.cid, socket.uid);
            if (!canMove) {
                throw new Error('[[error:no-privileges]]');
            }
            const tids = yield categories_1.default.getAllTopicIds(data.currentCid, 0, -1);
            data.uid = socket.uid;
            yield async.eachLimit(tids, 50, (tid) => __awaiter(this, void 0, void 0, function* () {
                yield topics.tools.move(tid, data);
            }));
            yield events.log({
                type: `topic-move-all`,
                uid: socket.uid,
                ip: socket.ip,
                fromCid: data.currentCid,
                toCid: data.cid,
            });
        });
    };
}
exports.default = default_1;
;
