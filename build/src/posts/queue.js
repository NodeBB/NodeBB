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
const validator = require('validator');
const nconf_1 = __importDefault(require("nconf"));
const database_1 = __importDefault(require("../database"));
const user_1 = __importDefault(require("../user"));
const meta_1 = __importDefault(require("../meta"));
const groups = require('../groups');
const topics = require('../topics');
const categories = require('../categories');
const notifications = require('../notifications');
const privileges = require('../privileges');
const plugins = require('../plugins');
const utils = require('../utils');
const cache = require('../cache');
const socketHelpers = require('../socket.io/helpers');
function default_1(Posts) {
    Posts.getQueuedPosts = (filter = {}, options = {}) => __awaiter(this, void 0, void 0, function* () {
        options = Object.assign({ metadata: true }, options); // defaults
        let postData = _.cloneDeep(cache.get('post-queue'));
        if (!postData) {
            const ids = yield database_1.default.getSortedSetRange('post:queue', 0, -1);
            const keys = ids.map(id => `post:queue:${id}`);
            postData = yield database_1.default.getObjects(keys);
            postData.forEach((data) => {
                if (data) {
                    data.data = JSON.parse(data.data);
                    data.data.timestampISO = utils.toISOString(data.data.timestamp);
                }
            });
            const uids = postData.map(data => data && data.uid);
            const userData = yield user_1.default.getUsersFields(uids, ['username', 'userslug', 'picture']);
            postData.forEach((postData, index) => {
                if (postData) {
                    postData.user = userData[index];
                    postData.data.rawContent = validator.escape(String(postData.data.content));
                    postData.data.title = validator.escape(String(postData.data.title || ''));
                }
            });
            cache.set('post-queue', _.cloneDeep(postData));
        }
        if (filter.id) {
            postData = postData.filter(p => p.id === filter.id);
        }
        if (options.metadata) {
            yield Promise.all(postData.map(p => addMetaData(p)));
        }
        // Filter by tid if present
        if (utils.isNumber(filter.tid)) {
            const tid = parseInt(filter.tid, 10);
            postData = postData.filter((item) => item.data.tid && parseInt(item.data.tid, 10) === tid);
        }
        else if (Array.isArray(filter.tid)) {
            const tids = filter.tid.map(tid => parseInt(tid, 10));
            postData = postData.filter((item) => item.data.tid && tids.includes(parseInt(item.data.tid, 10)));
        }
        return postData;
    });
    function addMetaData(postData) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!postData) {
                return;
            }
            postData.topic = { cid: 0 };
            if (postData.data.cid) {
                postData.topic = { cid: parseInt(postData.data.cid, 10) };
            }
            else if (postData.data.tid) {
                postData.topic = yield topics.getTopicFields(postData.data.tid, ['title', 'cid']);
            }
            postData.category = yield categories.getCategoryData(postData.topic.cid);
            const result = yield plugins.hooks.fire('filter:parse.post', { postData: postData.data });
            postData.data.content = result.postData.content;
        });
    }
    Posts.shouldQueue = function (uid, data) {
        return __awaiter(this, void 0, void 0, function* () {
            const [userData, isMemberOfExempt, categoryQueueEnabled] = yield Promise.all([
                user_1.default.getUserFields(uid, ['uid', 'reputation', 'postcount']),
                groups.isMemberOfAny(uid, meta_1.default.config.groupsExemptFromPostQueue),
                isCategoryQueueEnabled(data),
            ]);
            const shouldQueue = meta_1.default.config.postQueue && categoryQueueEnabled &&
                !isMemberOfExempt &&
                (!userData.uid || userData.reputation < meta_1.default.config.postQueueReputationThreshold || userData.postcount <= 0);
            const result = yield plugins.hooks.fire('filter:post.shouldQueue', {
                shouldQueue: !!shouldQueue,
                uid: uid,
                data: data,
            });
            return result.shouldQueue;
        });
    };
    function isCategoryQueueEnabled(data) {
        return __awaiter(this, void 0, void 0, function* () {
            const type = getType(data);
            const cid = yield getCid(type, data);
            if (!cid) {
                throw new Error('[[error:invalid-cid]]');
            }
            return yield categories.getCategoryField(cid, 'postQueue');
        });
    }
    function getType(data) {
        if (data.hasOwnProperty('tid')) {
            return 'reply';
        }
        else if (data.hasOwnProperty('cid')) {
            return 'topic';
        }
        throw new Error('[[error:invalid-type]]');
    }
    function removeQueueNotification(id) {
        return __awaiter(this, void 0, void 0, function* () {
            yield notifications.rescind(`post-queue-${id}`);
            const data = yield getParsedObject(id);
            if (!data) {
                return;
            }
            const cid = yield getCid(data.type, data);
            const uids = yield getNotificationUids(cid);
            uids.forEach(uid => user_1.default.notifications.pushCount(uid));
        });
    }
    function getNotificationUids(cid) {
        return __awaiter(this, void 0, void 0, function* () {
            const results = yield Promise.all([
                groups.getMembersOfGroups(['administrators', 'Global Moderators']),
                categories.getModeratorUids([cid]),
            ]);
            return _.uniq(_.flattenDeep(results));
        });
    }
    Posts.addToQueue = function (data) {
        return __awaiter(this, void 0, void 0, function* () {
            const type = getType(data);
            const now = Date.now();
            const id = `${type}-${now}`;
            yield canPost(type, data);
            let payload = {
                id: id,
                uid: data.uid,
                type: type,
                data: data,
            };
            payload = yield plugins.hooks.fire('filter:post-queue.save', payload);
            payload.data = JSON.stringify(data);
            yield database_1.default.sortedSetAdd('post:queue', now, id);
            yield database_1.default.setObject(`post:queue:${id}`, payload);
            yield user_1.default.setUserField(data.uid, 'lastqueuetime', now);
            cache.del('post-queue');
            const cid = yield getCid(type, data);
            const uids = yield getNotificationUids(cid);
            const bodyLong = yield parseBodyLong(cid, type, data);
            const notifObj = yield notifications.create({
                type: 'post-queue',
                nid: `post-queue-${id}`,
                mergeId: 'post-queue',
                bodyShort: '[[notifications:post_awaiting_review]]',
                bodyLong: bodyLong,
                path: `/post-queue/${id}`,
            });
            yield notifications.push(notifObj, uids);
            return {
                id: id,
                type: type,
                queued: true,
                message: '[[success:post-queued]]',
            };
        });
    };
    function parseBodyLong(cid, type, data) {
        return __awaiter(this, void 0, void 0, function* () {
            const url = nconf_1.default.get('url');
            const [content, category, userData] = yield Promise.all([
                plugins.hooks.fire('filter:parse.raw', data.content),
                categories.getCategoryFields(cid, ['name', 'slug']),
                user_1.default.getUserFields(data.uid, ['uid', 'username']),
            ]);
            category.url = `${url}/category/${category.slug}`;
            if (userData.uid > 0) {
                userData.url = `${url}/uid/${userData.uid}`;
            }
            const topic = { cid: cid, title: data.title, tid: data.tid };
            if (type === 'reply') {
                topic.title = yield topics.getTopicField(data.tid, 'title');
                topic.url = `${url}/topic/${data.tid}`;
            }
            const { app } = require('../webserver');
            return yield app.renderAsync('emails/partials/post-queue-body', {
                content: content,
                category: category,
                user: userData,
                topic: topic,
            });
        });
    }
    function getCid(type, data) {
        return __awaiter(this, void 0, void 0, function* () {
            if (type === 'topic') {
                return data.cid;
            }
            else if (type === 'reply') {
                return yield topics.getTopicField(data.tid, 'cid');
            }
            return null;
        });
    }
    function canPost(type, data) {
        return __awaiter(this, void 0, void 0, function* () {
            const cid = yield getCid(type, data);
            const typeToPrivilege = {
                topic: 'topics:create',
                reply: 'topics:reply',
            };
            topics.checkContent(data.content);
            if (type === 'topic') {
                topics.checkTitle(data.title);
                if (data.tags) {
                    yield topics.validateTags(data.tags, cid, data.uid);
                }
            }
            const [canPost] = yield Promise.all([
                privileges.categories.can(typeToPrivilege[type], cid, data.uid),
                user_1.default.isReadyToQueue(data.uid, cid),
            ]);
            if (!canPost) {
                throw new Error('[[error:no-privileges]]');
            }
        });
    }
    Posts.removeFromQueue = function (id) {
        return __awaiter(this, void 0, void 0, function* () {
            const data = yield getParsedObject(id);
            if (!data) {
                return null;
            }
            const result = yield plugins.hooks.fire('filter:post-queue:removeFromQueue', { data: data });
            yield removeFromQueue(id);
            plugins.hooks.fire('action:post-queue:removeFromQueue', { data: result.data });
            return result.data;
        });
    };
    function removeFromQueue(id) {
        return __awaiter(this, void 0, void 0, function* () {
            yield removeQueueNotification(id);
            yield database_1.default.sortedSetRemove('post:queue', id);
            yield database_1.default.delete(`post:queue:${id}`);
            cache.del('post-queue');
        });
    }
    Posts.submitFromQueue = function (id) {
        return __awaiter(this, void 0, void 0, function* () {
            let data = yield getParsedObject(id);
            if (!data) {
                return null;
            }
            const result = yield plugins.hooks.fire('filter:post-queue:submitFromQueue', { data: data });
            data = result.data;
            if (data.type === 'topic') {
                const result = yield createTopic(data.data);
                data.pid = result.postData.pid;
            }
            else if (data.type === 'reply') {
                const result = yield createReply(data.data);
                data.pid = result.pid;
            }
            yield removeFromQueue(id);
            plugins.hooks.fire('action:post-queue:submitFromQueue', { data: data });
            return data;
        });
    };
    Posts.getFromQueue = function (id) {
        return __awaiter(this, void 0, void 0, function* () {
            return yield getParsedObject(id);
        });
    };
    function getParsedObject(id) {
        return __awaiter(this, void 0, void 0, function* () {
            const data = yield database_1.default.getObject(`post:queue:${id}`);
            if (!data) {
                return null;
            }
            data.data = JSON.parse(data.data);
            data.data.fromQueue = true;
            return data;
        });
    }
    function createTopic(data) {
        return __awaiter(this, void 0, void 0, function* () {
            const result = yield topics.post(data);
            socketHelpers.notifyNew(data.uid, 'newTopic', { posts: [result.postData], topic: result.topicData });
            return result;
        });
    }
    function createReply(data) {
        return __awaiter(this, void 0, void 0, function* () {
            const postData = yield topics.reply(data);
            const result = {
                posts: [postData],
                'reputation:disabled': !!meta_1.default.config['reputation:disabled'],
                'downvote:disabled': !!meta_1.default.config['downvote:disabled'],
            };
            socketHelpers.notifyNew(data.uid, 'newPost', result);
            return postData;
        });
    }
    Posts.editQueuedContent = function (uid, editData) {
        return __awaiter(this, void 0, void 0, function* () {
            const canEditQueue = yield Posts.canEditQueue(uid, editData, 'edit');
            if (!canEditQueue) {
                throw new Error('[[error:no-privileges]]');
            }
            const data = yield getParsedObject(editData.id);
            if (!data) {
                return;
            }
            if (editData.content !== undefined) {
                data.data.content = editData.content;
            }
            if (editData.title !== undefined) {
                data.data.title = editData.title;
            }
            if (editData.cid !== undefined) {
                data.data.cid = editData.cid;
            }
            yield database_1.default.setObjectField(`post:queue:${editData.id}`, 'data', JSON.stringify(data.data));
            cache.del('post-queue');
        });
    };
    Posts.canEditQueue = function (uid, editData, action) {
        return __awaiter(this, void 0, void 0, function* () {
            const [isAdminOrGlobalMod, data] = yield Promise.all([
                user_1.default.isAdminOrGlobalMod(uid),
                getParsedObject(editData.id),
            ]);
            if (!data) {
                return false;
            }
            const selfPost = parseInt(uid, 10) === parseInt(data.uid, 10);
            if (isAdminOrGlobalMod || ((action === 'reject' || action === 'edit') && selfPost)) {
                return true;
            }
            let cid;
            if (data.type === 'topic') {
                cid = data.data.cid;
            }
            else if (data.type === 'reply') {
                cid = yield topics.getTopicField(data.data.tid, 'cid');
            }
            const isModerator = yield user_1.default.isModerator(uid, cid);
            let isModeratorOfTargetCid = true;
            if (editData.cid) {
                isModeratorOfTargetCid = yield user_1.default.isModerator(uid, editData.cid);
            }
            return isModerator && isModeratorOfTargetCid;
        });
    };
    Posts.updateQueuedPostsTopic = function (newTid, tids) {
        return __awaiter(this, void 0, void 0, function* () {
            const postData = yield Posts.getQueuedPosts({ tid: tids }, { metadata: false });
            if (postData.length) {
                postData.forEach((post) => {
                    post.data.tid = newTid;
                });
                yield database_1.default.setObjectBulk(postData.map(p => [`post:queue:${p.id}`, { data: JSON.stringify(p.data) }]));
                cache.del('post-queue');
            }
        });
    };
}
exports.default = default_1;
;
