'use strict';

const posts = require('../../posts');
const topics = require('../../topics');
const flags = require('../../flags');
const events = require('../../events');
const websockets = require('../index');
const socketTopics = require('../topics');
const privileges = require('../../privileges');
const plugins = require('../../plugins');
const social = require('../../social');
const user = require('../../user');
const utils = require('../../utils');


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
			tools: plugins.fireHook('filter:post.tools', { pid: data.pid, uid: socket.uid, tools: [] }),
			postSharing: social.getActivePostSharing(),
			history: posts.diffs.exists(data.pid),
			canViewInfo: privileges.global.can('view:users:info', socket.uid),
		});

		const postData = results.posts;
		postData.tools = results.tools.tools;
		postData.bookmarked = results.bookmarked;
		postData.selfPost = socket.uid && socket.uid === postData.uid;
		postData.display_edit_tools = results.canEdit.flag;
		postData.display_delete_tools = results.canDelete.flag;
		postData.display_purge_tools = results.canPurge;
		postData.display_flag_tools = socket.uid && !postData.selfPost && results.canFlag.flag;
		postData.display_moderator_tools = postData.display_edit_tools || postData.display_delete_tools;
		postData.display_move_tools = results.isAdmin || results.isModerator;
		postData.display_change_owner_tools = results.isAdmin || results.isModerator;
		postData.display_ip_ban = (results.isAdmin || results.isGlobalMod) && !postData.selfPost;
		postData.display_history = results.history;
		postData.toolsVisible = postData.tools.length || postData.display_moderator_tools;
		postData.flags = {
			flagId: parseInt(results.posts.flagId, 10) || null,
			can: results.canFlag.flag,
			exists: !!results.posts.flagId,
			flagged: results.flagged,
		};

		if (!results.isAdmin && !results.canViewInfo) {
			postData.ip = undefined;
		}
		return results;
	};

	SocketPosts.delete = async function (socket, data) {
		await deleteOrRestore(socket, data, {
			command: 'delete',
			event: 'event:post_deleted',
			type: 'post-delete',
		});
	};

	SocketPosts.restore = async function (socket, data) {
		await deleteOrRestore(socket, data, {
			command: 'restore',
			event: 'event:post_restored',
			type: 'post-restore',
		});
	};

	async function deleteOrRestore(socket, data, params) {
		if (!data || !data.pid) {
			throw new Error('[[error:invalid-data]]');
		}
		const postData = await posts.tools[params.command](socket.uid, data.pid);
		const results = await isMainAndLastPost(data.pid);
		if (results.isMain && results.isLast) {
			await deleteOrRestoreTopicOf(params.command, data.pid, socket);
		}

		websockets.in('topic_' + data.tid).emit(params.event, postData);

		await events.log({
			type: params.type,
			uid: socket.uid,
			pid: data.pid,
			tid: postData.tid,
			ip: socket.ip,
		});
	}

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
			await SocketPosts[command](socket, { pid: pid, tid: data.tid });
		}
	}

	SocketPosts.purge = async function (socket, data) {
		if (!data || !parseInt(data.pid, 10)) {
			throw new Error('[[error:invalid-data]]');
		}

		const results = await isMainAndLastPost(data.pid);
		if (results.isMain && !results.isLast) {
			throw new Error('[[error:cant-purge-main-post]]');
		}

		const isMainAndLast = results.isMain && results.isLast;
		const postData = await posts.getPostFields(data.pid, ['toPid', 'tid']);
		postData.pid = data.pid;

		await posts.tools.purge(socket.uid, data.pid);

		websockets.in('topic_' + data.tid).emit('event:post_purged', postData);
		const topicData = await topics.getTopicFields(data.tid, ['title', 'cid']);

		await events.log({
			type: 'post-purge',
			uid: socket.uid,
			pid: data.pid,
			ip: socket.ip,
			tid: postData.tid,
			title: String(topicData.title),
		});

		if (isMainAndLast) {
			await socketTopics.doTopicAction('purge', 'event:topic_purged', socket, { tids: [postData.tid], cid: topicData.cid });
		}
	};

	async function deleteOrRestoreTopicOf(command, pid, socket) {
		const topic = await posts.getTopicFields(pid, ['tid', 'cid', 'deleted']);
		if (command === 'delete' && !topic.deleted) {
			await socketTopics.doTopicAction('delete', 'event:topic_deleted', socket, { tids: [topic.tid], cid: topic.cid });
		} else if (command === 'restore' && topic.deleted) {
			await socketTopics.doTopicAction('restore', 'event:topic_restored', socket, { tids: [topic.tid], cid: topic.cid });
		}
	}

	async function isMainAndLastPost(pid) {
		const [isMain, topicData] = await Promise.all([
			posts.isMain(pid),
			posts.getTopicFields(pid, ['postcount']),
		]);
		return {
			isMain: isMain,
			isLast: topicData && topicData.postcount === 1,
		};
	}

	SocketPosts.changeOwner = async function (socket, data) {
		if (!data || !Array.isArray(data.pids) || !data.toUid) {
			throw new Error('[[error:invalid-data]]');
		}
		const isAdminOrGlobalMod = await user.isAdminOrGlobalMod(socket.uid);
		if (!isAdminOrGlobalMod) {
			throw new Error('[[error:no-privileges]]');
		}

		var postData = await posts.changeOwner(data.pids, data.toUid);
		var logs = postData.map(({ pid, uid, cid }) => (events.log({
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
