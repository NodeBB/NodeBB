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
Object.defineProperty(exports, "__esModule", { value: true });
const topics = require('../../topics');
const privileges = require('../../privileges');
const plugins = require('../../plugins');
function default_1(SocketTopics) {
    SocketTopics.loadTopicTools = function (socket, data) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!socket.uid) {
                throw new Error('[[error:no-privileges]]');
            }
            if (!data) {
                throw new Error('[[error:invalid-data]]');
            }
            const [topicData, userPrivileges] = yield Promise.all([
                topics.getTopicData(data.tid),
                privileges.topics.get(data.tid, socket.uid),
            ]);
            if (!topicData) {
                throw new Error('[[error:no-topic]]');
            }
            if (!userPrivileges['topics:read']) {
                throw new Error('[[error:no-privileges]]');
            }
            topicData.privileges = userPrivileges;
            const result = yield plugins.hooks.fire('filter:topic.thread_tools', { topic: topicData, uid: socket.uid, tools: [] });
            result.topic.thread_tools = result.tools;
            return result.topic;
        });
    };
    SocketTopics.orderPinnedTopics = function (socket, data) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!data || !data.tid) {
                throw new Error('[[error:invalid-data]]');
            }
            yield topics.tools.orderPinnedTopics(socket.uid, data);
        });
    };
}
exports.default = default_1;
;
