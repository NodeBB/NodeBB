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
const topics = require('../../topics');
const privileges = require('../../privileges');
const meta_1 = __importDefault(require("../../meta"));
const utils = require('../../utils');
const social = require('../../social');
function default_1(SocketTopics) {
    SocketTopics.loadMore = function (socket, data) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!data || !data.tid || !utils.isNumber(data.after) || parseInt(data.after, 10) < 0) {
                throw new Error('[[error:invalid-data]]');
            }
            const [userPrivileges, topicData] = yield Promise.all([
                privileges.topics.get(data.tid, socket.uid),
                topics.getTopicData(data.tid),
            ]);
            if (!userPrivileges['topics:read'] || !privileges.topics.canViewDeletedScheduled(topicData, userPrivileges)) {
                throw new Error('[[error:no-privileges]]');
            }
            const set = data.topicPostSort === 'most_votes' ? `tid:${data.tid}:posts:votes` : `tid:${data.tid}:posts`;
            const reverse = data.topicPostSort === 'newest_to_oldest' || data.topicPostSort === 'most_votes';
            let start = Math.max(0, parseInt(data.after, 10));
            const infScrollPostsPerPage = Math.max(0, Math.min(meta_1.default.config.postsPerPage || 20, parseInt(data.count, 10) || meta_1.default.config.postsPerPage || 20));
            if (data.direction === -1) {
                start -= infScrollPostsPerPage;
            }
            let stop = start + infScrollPostsPerPage - 1;
            start = Math.max(0, start);
            stop = Math.max(0, stop);
            const [posts, postSharing] = yield Promise.all([
                topics.getTopicPosts(topicData, set, start, stop, socket.uid, reverse),
                social.getActivePostSharing(),
            ]);
            topicData.posts = posts;
            topicData.privileges = userPrivileges;
            topicData.postSharing = postSharing;
            topicData['reputation:disabled'] = meta_1.default.config['reputation:disabled'] === 1;
            topicData['downvote:disabled'] = meta_1.default.config['downvote:disabled'] === 1;
            topics.modifyPostsByPrivilege(topicData, userPrivileges);
            return topicData;
        });
    };
}
exports.default = default_1;
;
