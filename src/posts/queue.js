'use strict';

const _ = require('lodash');

const db = require('../database');
const user = require('../user');
const meta = require('../meta');
const groups = require('../groups');
const topics = require('../topics');
const categories = require('../categories');
const notifications = require('../notifications');
const privileges = require('../privileges');
const plugins = require('../plugins');
const socketHelpers = require('../socket.io/helpers');

module.exports = function (Posts) {
	Posts.shouldQueue = async function (uid, data) {
		const userData = await user.getUserFields(uid, ['uid', 'reputation', 'postcount']);
		const isMemberOfExempt = await groups.isMemberOfAny(userData.uid, meta.config.groupsExemptFromPostQueue);
		const shouldQueue = meta.config.postQueue && !isMemberOfExempt && (!userData.uid || userData.reputation < meta.config.postQueueReputationThreshold || userData.postcount <= 0);
		const result = await plugins.fireHook('filter:post.shouldQueue', {
			shouldQueue: !!shouldQueue,
			uid: uid,
			data: data,
		});
		return result.shouldQueue;
	};

	async function removeQueueNotification(id) {
		await notifications.rescind('post-queue-' + id);
		const data = await getParsedObject(id);
		if (!data) {
			return;
		}
		const cid = await getCid(data.type, data);
		const uids = await getNotificationUids(cid);
		uids.forEach(uid => user.notifications.pushCount(uid));
	}

	async function getNotificationUids(cid) {
		const results = await Promise.all([
			groups.getMembersOfGroups(['administrators', 'Global Moderators']),
			categories.getModeratorUids([cid]),
		]);
		return _.uniq(_.flattenDeep(results));
	}

	Posts.addToQueue = async function (data) {
		const type = data.title ? 'topic' : 'reply';
		const now = Date.now();
		const id = type + '-' + now;
		await canPost(type, data);

		let payload = {
			id: id,
			uid: data.uid,
			type: type,
			data: data,
		};
		payload = await plugins.fireHook('filter:post.queue', payload);
		payload.data = JSON.stringify(data);

		await db.sortedSetAdd('post:queue', now, id);
		await db.setObject('post:queue:' + id, payload);
		await user.setUserField(data.uid, 'lastqueuetime', now);

		const cid = await getCid(type, data);
		const uids = await getNotificationUids(cid);
		const notifObj = await notifications.create({
			type: 'post-queue',
			nid: 'post-queue-' + id,
			mergeId: 'post-queue',
			bodyShort: '[[notifications:post_awaiting_review]]',
			bodyLong: data.content,
			path: '/post-queue',
		});
		await notifications.push(notifObj, uids);
		return {
			id: id,
			type: type,
			queued: true,
			message: '[[success:post-queued]]',
		};
	};

	async function getCid(type, data) {
		if (type === 'topic') {
			return data.cid;
		} else if (type === 'reply') {
			return await topics.getTopicField(data.tid, 'cid');
		}
		return null;
	}

	async function canPost(type, data) {
		const cid = await getCid(type, data);
		const typeToPrivilege = {
			topic: 'topics:create',
			reply: 'topics:reply',
		};

		topics.checkContent(data.content);
		if (type === 'topic') {
			topics.checkTitle(data.title);
			if (data.tags) {
				await topics.validateTags(data.tags);
			}
		}

		const [canPost] = await Promise.all([
			privileges.categories.can(typeToPrivilege[type], cid, data.uid),
			user.isReadyToQueue(data.uid, cid),
		]);
		if (!canPost) {
			throw new Error('[[error:no-privileges]]');
		}
	}

	Posts.removeFromQueue = async function (id) {
		await removeQueueNotification(id);
		await db.sortedSetRemove('post:queue', id);
		await db.delete('post:queue:' + id);
	};

	Posts.submitFromQueue = async function (id) {
		const data = await getParsedObject(id);
		if (!data) {
			return;
		}
		if (data.type === 'topic') {
			await createTopic(data.data);
		} else if (data.type === 'reply') {
			await createReply(data.data);
		}
		await Posts.removeFromQueue(id);
	};

	async function getParsedObject(id) {
		const data = await db.getObject('post:queue:' + id);
		if (!data) {
			return null;
		}
		data.data = JSON.parse(data.data);
		data.data.fromQueue = true;
		return data;
	}

	async function createTopic(data) {
		const result = await topics.post(data);
		socketHelpers.notifyNew(data.uid, 'newTopic', { posts: [result.postData], topic: result.topicData });
	}

	async function createReply(data) {
		const postData = await topics.reply(data);
		const result = {
			posts: [postData],
			'reputation:disabled': !!meta.config['reputation:disabled'],
			'downvote:disabled': !!meta.config['downvote:disabled'],
		};
		socketHelpers.notifyNew(data.uid, 'newPost', result);
	}

	Posts.editQueuedContent = async function (uid, editData) {
		const canEditQueue = await Posts.canEditQueue(uid, editData);
		if (!canEditQueue) {
			throw new Error('[[error:no-privileges]]');
		}
		const data = await getParsedObject(editData.id);
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
		await db.setObjectField('post:queue:' + editData.id, 'data', JSON.stringify(data.data));
	};

	Posts.canEditQueue = async function (uid, editData) {
		const [isAdminOrGlobalMod, data] = await Promise.all([
			user.isAdminOrGlobalMod(uid),
			getParsedObject(editData.id),
		]);
		if (!data) {
			return false;
		}

		if (isAdminOrGlobalMod) {
			return true;
		}

		let cid;
		if (data.type === 'topic') {
			cid = data.data.cid;
		} else if (data.type === 'reply') {
			cid = await topics.getTopicField(data.data.tid, 'cid');
		}
		const isModerator = await user.isModerator(uid, cid);
		let isModeratorOfTargetCid = true;
		if (editData.cid) {
			isModeratorOfTargetCid = await user.isModerator(uid, editData.cid);
		}
		return isModerator && isModeratorOfTargetCid;
	};
};
