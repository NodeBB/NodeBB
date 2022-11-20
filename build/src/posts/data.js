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
const database_1 = __importDefault(require("../database"));
const plugins = require('../plugins');
const utils = require('../utils');
const intFields = [
    'uid', 'pid', 'tid', 'deleted', 'timestamp',
    'upvotes', 'downvotes', 'deleterUid', 'edited',
    'replies', 'bookmarks',
];
function default_1(Posts) {
    Posts.getPostsFields = function (pids, fields) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!Array.isArray(pids) || !pids.length) {
                return [];
            }
            const keys = pids.map(pid => `post:${pid}`);
            const postData = yield database_1.default.getObjects(keys, fields);
            const result = yield plugins.hooks.fire('filter:post.getFields', {
                pids: pids,
                posts: postData,
                fields: fields,
            });
            result.posts.forEach(post => modifyPost(post, fields));
            return result.posts;
        });
    };
    Posts.getPostData = function (pid) {
        return __awaiter(this, void 0, void 0, function* () {
            const posts = yield Posts.getPostsFields([pid], []);
            return posts && posts.length ? posts[0] : null;
        });
    };
    Posts.getPostsData = function (pids) {
        return __awaiter(this, void 0, void 0, function* () {
            return yield Posts.getPostsFields(pids, []);
        });
    };
    Posts.getPostField = function (pid, field) {
        return __awaiter(this, void 0, void 0, function* () {
            const post = yield Posts.getPostFields(pid, [field]);
            return post ? post[field] : null;
        });
    };
    Posts.getPostFields = function (pid, fields) {
        return __awaiter(this, void 0, void 0, function* () {
            const posts = yield Posts.getPostsFields([pid], fields);
            return posts ? posts[0] : null;
        });
    };
    Posts.setPostField = function (pid, field, value) {
        return __awaiter(this, void 0, void 0, function* () {
            yield Posts.setPostFields(pid, { [field]: value });
        });
    };
    Posts.setPostFields = function (pid, data) {
        return __awaiter(this, void 0, void 0, function* () {
            yield database_1.default.setObject(`post:${pid}`, data);
            plugins.hooks.fire('action:post.setFields', { data: Object.assign(Object.assign({}, data), { pid }) });
        });
    };
}
exports.default = default_1;
;
function modifyPost(post, fields) {
    if (post) {
        database_1.default.parseIntFields(post, intFields, fields);
        if (post.hasOwnProperty('upvotes') && post.hasOwnProperty('downvotes')) {
            post.votes = post.upvotes - post.downvotes;
        }
        if (post.hasOwnProperty('timestamp')) {
            post.timestampISO = utils.toISOString(post.timestamp);
        }
        if (post.hasOwnProperty('edited')) {
            post.editedISO = post.edited !== 0 ? utils.toISOString(post.edited) : '';
        }
    }
}
