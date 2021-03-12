'use strict';

const db = require('../../database');
const posts = require('../../posts');
const flags = require('../../flags');
const events = require('../../events');
const privileges = require('../../privileges');
const plugins = require('../../plugins');
const social = require('../../social');
const user = require('../../user');
const utils = require('../../utils');
const api = require('../../api');

const sockets = require('..');

module.exports = function (SocketPosts) {
	SocketPosts.loadPostTools = async function (socket, data) {
		if (!data || !data.pid || !data.cid) {
			throw new Error('[[error:invalid-data]]');
		}

		const results = await utils.promiseParallel({
			posts: posts.getPostFields(data.pid, ['deleted', 'bookmarks', 'uid', 'ip', 'flagId']),
			isAdmin: user.isAdministrator(socket.uid),
			isGlobalMod: user.isGlobalModerator(socket.uid),
			isModerator: user.isModerator(socket.uid, data.cid),
			canEdit: privileges.posts.canEdit(data.pid, socket.uid),
			canDelete: privileges.posts.canDelete(data.pid, socket.uid),
			canPurge: privileges.posts.canPurge(data.pid, socket.uid),
			canFlag: privileges.posts.canFlag(data.pid, socket.uid),
			flagged: flags.exists('post', data.pid, socket.uid),	// specifically, whether THIS calling user flagged
			bookmarked: posts.hasBookmarked(data.pid, socket.uid),
			postSharing: social.getActivePostSharing(),
			history: posts.diffs.exists(data.pid),
			canViewInfo: privileges.global.can('view:users:info', socket.uid),
		});

		const postData = results.posts;
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
			state: await db.getObjectField(`flag:${postData.flagId}`, 'state'),
		};

		if (!results.isAdmin && !results.canViewInfo) {
			postData.ip = undefined;
		}
		const tools = await plugins.hooks.fire('filter:post.tools', {
			pid: data.pid,
			post: postData,
			uid: socket.uid,
			tools: [],
		});
		postData.tools = tools.tools;
		return results;
	};

	SocketPosts.delete = async function (socket, data) {
		sockets.warnDeprecated(socket, 'DELETE /api/v3/posts/:pid/state');
		await api.posts.delete(socket, data);
	};

	SocketPosts.restore = async function (socket, data) {
		sockets.warnDeprecated(socket, 'PUT /api/v3/posts/:pid/state');
		await api.posts.restore(socket, data);
	};

	SocketPosts.deletePosts = async function (socket, data) {
		await deletePurgePosts(socket, data, 'delete');
	};

	SocketPosts.purgePosts = async function (socket, data) {
		await deletePurgePosts(socket, data, 'purge');
	};

	async function deletePurgePosts(socket, data, command) {
		if (!data || !Array.isArray(data.pids)) {
			throw new Error('[[error:invalid-data]]');
		}
		for (const pid of data.pids) {
			/* eslint-disable no-await-in-loop */
			await SocketPosts[command](socket, { pid: pid });
		}
	}

	SocketPosts.purge = async function (socket, data) {
		sockets.warnDeprecated(socket, 'DELETE /api/v3/posts/:pid');
		await api.posts.purge(socket, data);
	};

	SocketPosts.changeOwner = async function (socket, data) {
		if (!data || !Array.isArray(data.pids) || !data.toUid) {
			throw new Error('[[error:invalid-data]]');
		}
		const isAdminOrGlobalMod = await user.isAdminOrGlobalMod(socket.uid);
		if (!isAdminOrGlobalMod) {
			throw new Error('[[error:no-privileges]]');
		}

		const postData = await posts.changeOwner(data.pids, data.toUid);
		const logs = postData.map(({ pid, uid, cid }) => (events.log({
			type: 'post-change-owner',
			uid: socket.uid,
			ip: socket.ip,
			targetUid: data.toUid,
			pid: pid,
			originalUid: uid,
			cid: cid,
		})));

		await Promise.all(logs);
	};
};
