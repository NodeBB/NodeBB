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
const nconf_1 = __importDefault(require("nconf"));
const database_1 = __importDefault(require("../../database"));
const posts = require('../../posts');
const flags = require('../../flags');
const events = require('../../events');
const privileges = require('../../privileges');
const plugins = require('../../plugins');
const social = require('../../social');
const user_1 = __importDefault(require("../../user"));
const utils = require('../../utils');
function default_1(SocketPosts) {
    SocketPosts.loadPostTools = function (socket, data) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!data || !data.pid || !data.cid) {
                throw new Error('[[error:invalid-data]]');
            }
            const results = yield utils.promiseParallel({
                posts: posts.getPostFields(data.pid, ['deleted', 'bookmarks', 'uid', 'ip', 'flagId']),
                isAdmin: user_1.default.isAdministrator(socket.uid),
                isGlobalMod: user_1.default.isGlobalModerator(socket.uid),
                isModerator: user_1.default.isModerator(socket.uid, data.cid),
                canEdit: privileges.posts.canEdit(data.pid, socket.uid),
                canDelete: privileges.posts.canDelete(data.pid, socket.uid),
                canPurge: privileges.posts.canPurge(data.pid, socket.uid),
                canFlag: privileges.posts.canFlag(data.pid, socket.uid),
                flagged: flags.exists('post', data.pid, socket.uid),
                bookmarked: posts.hasBookmarked(data.pid, socket.uid),
                postSharing: social.getActivePostSharing(),
                history: posts.diffs.exists(data.pid),
                canViewInfo: privileges.global.can('view:users:info', socket.uid),
            });
            const postData = results.posts;
            postData.absolute_url = `${nconf_1.default.get('url')}/post/${data.pid}`;
            postData.bookmarked = results.bookmarked;
            postData.selfPost = socket.uid && socket.uid === postData.uid;
            postData.display_edit_tools = results.canEdit.flag;
            postData.display_delete_tools = results.canDelete.flag;
            postData.display_purge_tools = results.canPurge;
            postData.display_flag_tools = socket.uid && results.canFlag.flag;
            postData.display_moderator_tools = postData.display_edit_tools || postData.display_delete_tools;
            postData.display_move_tools = results.isAdmin || results.isModerator;
            postData.display_change_owner_tools = results.isAdmin || results.isModerator;
            postData.display_ip_ban = (results.isAdmin || results.isGlobalMod) && !postData.selfPost;
            postData.display_history = results.history;
            postData.flags = {
                flagId: parseInt(results.posts.flagId, 10) || null,
                can: results.canFlag.flag,
                exists: !!results.posts.flagId,
                flagged: results.flagged,
                state: yield database_1.default.getObjectField(`flag:${postData.flagId}`, 'state'),
            };
            if (!results.isAdmin && !results.canViewInfo) {
                postData.ip = undefined;
            }
            const { tools } = yield plugins.hooks.fire('filter:post.tools', {
                pid: data.pid,
                post: postData,
                uid: socket.uid,
                tools: [],
            });
            postData.tools = tools;
            return results;
        });
    };
    SocketPosts.changeOwner = function (socket, data) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!data || !Array.isArray(data.pids) || !data.toUid) {
                throw new Error('[[error:invalid-data]]');
            }
            const isAdminOrGlobalMod = yield user_1.default.isAdminOrGlobalMod(socket.uid);
            if (!isAdminOrGlobalMod) {
                throw new Error('[[error:no-privileges]]');
            }
            const postData = yield posts.changeOwner(data.pids, data.toUid);
            const logs = postData.map(({ pid, uid, cid }) => (events.log({
                type: 'post-change-owner',
                uid: socket.uid,
                ip: socket.ip,
                targetUid: data.toUid,
                pid: pid,
                originalUid: uid,
                cid: cid,
            })));
            yield Promise.all(logs);
        });
    };
}
exports.default = default_1;
;
