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
const _ = require('lodash');
const meta_1 = __importDefault(require("../meta"));
const database_1 = __importDefault(require("../database"));
const plugins = require('../plugins');
const user_1 = __importDefault(require("../user"));
const topics = require('../topics');
const categories = require('../categories');
const groups = require('../groups');
const utils = require('../utils');
function default_1(Posts) {
    Posts.create = function (data) {
        return __awaiter(this, void 0, void 0, function* () {
            // This is an internal method, consider using Topics.reply instead
            const { uid } = data;
            const { tid } = data;
            const content = data.content.toString();
            const timestamp = data.timestamp || Date.now();
            const isMain = data.isMain || false;
            if (!uid && parseInt(uid, 10) !== 0) {
                throw new Error('[[error:invalid-uid]]');
            }
            if (data.toPid && !utils.isNumber(data.toPid)) {
                throw new Error('[[error:invalid-pid]]');
            }
            const pid = yield database_1.default.incrObjectField('global', 'nextPid');
            let postData = {
                pid: pid,
                uid: uid,
                tid: tid,
                content: content,
                timestamp: timestamp,
            };
            if (data.toPid) {
                postData.toPid = data.toPid;
            }
            if (data.ip && meta_1.default.config.trackIpPerPost) {
                postData.ip = data.ip;
            }
            if (data.handle && !parseInt(uid, 10)) {
                postData.handle = data.handle;
            }
            let result = yield plugins.hooks.fire('filter:post.create', { post: postData, data: data });
            postData = result.post;
            yield database_1.default.setObject(`post:${postData.pid}`, postData);
            const topicData = yield topics.getTopicFields(tid, ['cid', 'pinned']);
            postData.cid = topicData.cid;
            yield Promise.all([
                database_1.default.sortedSetAdd('posts:pid', timestamp, postData.pid),
                database_1.default.incrObjectField('global', 'postCount'),
                user_1.default.onNewPostMade(postData),
                topics.onNewPostMade(postData),
                categories.onNewPostMade(topicData.cid, topicData.pinned, postData),
                groups.onNewPostMade(postData),
                addReplyTo(postData, timestamp),
                Posts.uploads.sync(postData.pid),
            ]);
            result = yield plugins.hooks.fire('filter:post.get', { post: postData, uid: data.uid });
            result.post.isMain = isMain;
            plugins.hooks.fire('action:post.save', { post: _.clone(result.post) });
            return result.post;
        });
    };
    function addReplyTo(postData, timestamp) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!postData.toPid) {
                return;
            }
            yield Promise.all([
                database_1.default.sortedSetAdd(`pid:${postData.toPid}:replies`, timestamp, postData.pid),
                database_1.default.incrObjectField(`post:${postData.toPid}`, 'replies'),
            ]);
        });
    }
}
exports.default = default_1;
;
