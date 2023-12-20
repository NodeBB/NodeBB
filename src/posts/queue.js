'use strict';

const _ = require('lodash');
const validator = require('validator');
const nconf = require('nconf');

const db = require('../database');
const user = require('../user');
const meta = require('../meta');
const groups = require('../groups');
const topics = require('../topics');
const categories = require('../categories');
const notifications = require('../notifications');
const privileges = require('../privileges');
const plugins = require('../plugins');
const utils = require('../utils');
const cache = require('../cache');
const socketHelpers = require('../socket.io/helpers');

module.exports = function (Posts) {
	Posts.getQueuedPosts = async (filter = {}, options = {}) => {
		options = { metadata: true, ...options }; // defaults
		let postData = _.cloneDeep(cache.get('post-queue'));
		if (!postData) {
			const ids = await db.getSortedSetRange('post:queue', 0, -1);
			const keys = ids.map(id => `post:queue:${id}`);
			postData = await db.getObjects(keys);
			postData.forEach((data) => {
				if (data) {
					data.data = JSON.parse(data.data);
					data.data.timestampISO = utils.toISOString(data.data.timestamp);
				}
			});
			const uids = postData.map(data => data && data.uid);
			const userData = await user.getUsersFields(uids, [
				'username', 'userslug', 'picture', 'joindate', 'postcount', 'reputation',
			]);
			postData.forEach((postData, index) => {
				if (postData) {
					postData.user = userData[index];
					if (postData.user.uid === 0 && postData.data.handle) {
						postData.user.username = validator.escape(String(postData.data.handle));
						postData.user.displayname = postData.user.username;
						postData.user.fullname = postData.user.username;
					}
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
			await Promise.all(postData.map(addMetaData));
		}

		// Filter by tid if present
		if (utils.isNumber(filter.tid)) {
			const tid = parseInt(filter.tid, 10);
			postData = postData.filter(item => item.data.tid && parseInt(item.data.tid, 10) === tid);
		} else if (Array.isArray(filter.tid)) {
			const tids = filter.tid.map(tid => parseInt(tid, 10));
			postData = postData.filter(
				item => item.data.tid && tids.includes(parseInt(item.data.tid, 10))
			);
		}

		return postData;
	};

	async function addMetaData(postData) {
		if (!postData) {
			return;
		}
		postData.topic = { cid: 0 };
		if (postData.data.cid) {
			postData.topic = { cid: parseInt(postData.data.cid, 10) };
		} else if (postData.data.tid) {
			postData.topic = await topics.getTopicFields(postData.data.tid, ['title', 'cid', 'lastposttime']);
		}
		postData.category = await categories.getCategoryData(postData.topic.cid);
		const result = await plugins.hooks.fire('filter:parse.post', { postData: postData.data });
		postData.data.content = result.postData.content;
	}

	Posts.canUserPostContentWithLinks = async function (uid, content) {
		if (!content) {
			return true;
		}
		const [reputation, isPrivileged] = await Promise.all([
			user.getUserField(uid, 'reputation'),
			user.isPrivileged(uid),
		]);

		if (!isPrivileged && reputation < meta.config['min:rep:post-links']) {
			const parsed = await plugins.hooks.fire('filter:parse.raw', String(content));
			const matches = parsed.matchAll(/<a[^>]*href="([^"]+)"[^>]*>/g);
			let external = 0;
			for (const [, href] of matches) {
				const internal = utils.isInternalURI(new URL(href, nconf.get('url')), new URL(nconf.get('url')), nconf.get('relative_path'));
				if (!internal) {
					external += 1;
				}
			}

			return external === 0;
		}
		return true;
	};

	Posts.shouldQueue = async function (uid, data) {
		let shouldQueue = meta.config.postQueue;
		if (shouldQueue) {
			const [userData, isPrivileged, isMemberOfExempt, categoryQueueEnabled] = await Promise.all([
				user.getUserFields(uid, ['uid', 'reputation', 'postcount']),
				user.isPrivileged(uid),
				groups.isMemberOfAny(uid, meta.config.groupsExemptFromPostQueue),
				isCategoryQueueEnabled(data),
			]);
			shouldQueue = categoryQueueEnabled &&
				!isPrivileged &&
				!isMemberOfExempt &&
				(
					!userData.uid ||
					userData.reputation < meta.config.postQueueReputationThreshold ||
					userData.postcount <= 0 ||
					!await Posts.canUserPostContentWithLinks(uid, data.content)
				);
		}

		const result = await plugins.hooks.fire('filter:post.shouldQueue', {
			shouldQueue: !!shouldQueue,
			uid: uid,
			data: data,
		});
		return result.shouldQueue;
	};

	async function isCategoryQueueEnabled(data) {
		const type = getType(data);
		const cid = await getCid(type, data);
		if (!cid) {
			return true;
		}
		return await categories.getCategoryField(cid, 'postQueue');
	}

	function getType(data) {
		if (data.hasOwnProperty('tid')) {
			return 'reply';
		} else if (data.hasOwnProperty('cid')) {
			return 'topic';
		}
		throw new Error('[[error:invalid-type]]');
	}

	async function removeQueueNotification(id) {
		await notifications.rescind(`post-queue-${id}`);
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
		const type = getType(data);
		const now = Date.now();
		const id = `${type}-${now}`;
		await canPost(type, data);

		let payload = {
			id: id,
			uid: data.uid,
			type: type,
			data: data,
		};
		payload = await plugins.hooks.fire('filter:post-queue.save', payload);
		payload.data = JSON.stringify(data);

		await db.sortedSetAdd('post:queue', now, id);
		await db.setObject(`post:queue:${id}`, payload);
		await user.setUserField(data.uid, 'lastqueuetime', now);
		cache.del('post-queue');

		const cid = await getCid(type, data);
		const uids = await getNotificationUids(cid);
		const bodyLong = await parseBodyLong(cid, type, data);

		const notifObj = await notifications.create({
			type: 'post-queue',
			nid: `post-queue-${id}`,
			mergeId: 'post-queue',
			bodyShort: '[[notifications:post-awaiting-review]]',
			bodyLong: bodyLong,
			path: `/post-queue/${id}`,
		});
		await notifications.push(notifObj, uids);
		return {
			id: id,
			type: type,
			queued: true,
			message: '[[success:post-queued]]',
		};
	};

	async function parseBodyLong(cid, type, data) {
		const url = nconf.get('url');
		const [content, category, userData] = await Promise.all([
			plugins.hooks.fire('filter:parse.raw', data.content),
			categories.getCategoryFields(cid, ['name', 'slug']),
			user.getUserFields(data.uid, ['uid', 'username']),
		]);

		category.url = `${url}/category/${category.slug}`;
		if (userData.uid > 0) {
			userData.url = `${url}/uid/${userData.uid}`;
		}

		const topic = { cid: cid, title: data.title, tid: data.tid };
		if (type === 'reply') {
			topic.title = await topics.getTopicField(data.tid, 'title');
			topic.url = `${url}/topic/${data.tid}`;
		}
		const { app } = require('../webserver');
		return await app.renderAsync('emails/partials/post-queue-body', {
			content: content,
			category: category,
			user: userData,
			topic: topic,
		});
	}

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
				await topics.validateTags(data.tags, cid, data.uid);
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
		const data = await getParsedObject(id);
		if (!data) {
			return null;
		}
		const result = await plugins.hooks.fire('filter:post-queue:removeFromQueue', { data: data });
		await removeFromQueue(id);
		plugins.hooks.fire('action:post-queue:removeFromQueue', { data: result.data });
		return result.data;
	};

	async function removeFromQueue(id) {
		await removeQueueNotification(id);
		await db.sortedSetRemove('post:queue', id);
		await db.delete(`post:queue:${id}`);
		cache.del('post-queue');
	}

	Posts.submitFromQueue = async function (id) {
		let data = await getParsedObject(id);
		if (!data) {
			return null;
		}
		const result = await plugins.hooks.fire('filter:post-queue:submitFromQueue', { data: data });
		data = result.data;
		if (data.type === 'topic') {
			const result = await createTopic(data.data);
			data.pid = result.postData.pid;
		} else if (data.type === 'reply') {
			const result = await createReply(data.data);
			data.pid = result.pid;
		}
		await removeFromQueue(id);
		plugins.hooks.fire('action:post-queue:submitFromQueue', { data: data });
		return data;
	};

	Posts.getFromQueue = async function (id) {
		return await getParsedObject(id);
	};

	async function getParsedObject(id) {
		const data = await db.getObject(`post:queue:${id}`);
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
		return result;
	}

	async function createReply(data) {
		const postData = await topics.reply(data);
		const result = {
			posts: [postData],
			'reputation:disabled': !!meta.config['reputation:disabled'],
			'downvote:disabled': !!meta.config['downvote:disabled'],
		};
		socketHelpers.notifyNew(data.uid, 'newPost', result);
		return postData;
	}

	Posts.editQueuedContent = async function (uid, editData) {
		const [canEditQueue, data] = await Promise.all([
			Posts.canEditQueue(uid, editData, 'edit'),
			getParsedObject(editData.id),
		]);
		if (!data) {
			throw new Error('[[error:no-post]]');
		}
		if (!canEditQueue) {
			throw new Error('[[error:no-privileges]]');
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
		await db.setObjectField(`post:queue:${editData.id}`, 'data', JSON.stringify(data.data));
		cache.del('post-queue');
	};

	Posts.canEditQueue = async function (uid, editData, action) {
		const [isAdminOrGlobalMod, data] = await Promise.all([
			user.isAdminOrGlobalMod(uid),
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

	Posts.updateQueuedPostsTopic = async function (newTid, tids) {
		const postData = await Posts.getQueuedPosts({ tid: tids }, { metadata: false });
		if (postData.length) {
			postData.forEach((post) => {
				post.data.tid = newTid;
			});
			await db.setObjectBulk(
				postData.map(p => [`post:queue:${p.id}`, { data: JSON.stringify(p.data) }]),
			);
			cache.del('post-queue');
		}
	};
};
