
'use strict';

const _ = require('lodash');
const winston = require('winston');

const db = require('../database');
const utils = require('../utils');
const slugify = require('../slugify');
const plugins = require('../plugins');
const analytics = require('../analytics');
const user = require('../user');
const activitypub = require('../activitypub');
const meta = require('../meta');
const posts = require('../posts');
const privileges = require('../privileges');
const categories = require('../categories');
const translator = require('../translator');

module.exports = function (Topics) {
	Topics.create = async function (data) {
		// This is an internal method, consider using Topics.post instead
		const timestamp = data.timestamp || Date.now();

		const tid = data.tid || await db.incrObjectField('global', 'nextTid');

		let topicData = {
			tid: tid,
			uid: data.uid,
			cid: data.cid,
			mainPid: 0,
			title: data.title,
			slug: `${tid}/${slugify(data.title) || 'topic'}`,
			timestamp: timestamp,
			lastposttime: 0,
			postcount: 0,
			viewcount: 0,
		};

		if (Array.isArray(data.tags) && data.tags.length) {
			topicData.tags = data.tags.join(',');
		}

		if (Array.isArray(data.thumbs) && data.thumbs.length) {
			const thumbs = Topics.thumbs.filterThumbs(data.thumbs);
			topicData.thumbs = JSON.stringify(thumbs);
			topicData.numThumbs = thumbs.length;
		}

		const result = await plugins.hooks.fire('filter:topic.create', { topic: topicData, data: data });
		topicData = result.topic;
		await db.setObject(`topic:${topicData.tid}`, topicData);

		const timestampedSortedSetKeys = [
			'topics:tid',
			`cid:${topicData.cid}:tids`,
			`cid:${topicData.cid}:tids:create`,
			`cid:${topicData.cid}:uid:${topicData.uid}:tids`,
		];
		const countedSortedSetKeys = [
			...['views', 'posts', 'votes'].map(prop => `${utils.isNumber(tid) ? 'topics' : 'topicsRemote'}:${prop}`),
			`cid:${topicData.cid}:tids:votes`,
			`cid:${topicData.cid}:tids:posts`,
			`cid:${topicData.cid}:tids:views`,
		];

		const scheduled = timestamp > Date.now();
		if (scheduled) {
			timestampedSortedSetKeys.push('topics:scheduled');
		}

		await Promise.all([
			db.sortedSetsAdd(timestampedSortedSetKeys, timestamp, topicData.tid),
			db.sortedSetsAdd(countedSortedSetKeys, 0, topicData.tid),
			user.addTopicIdToUser(topicData.uid, topicData.tid, timestamp),
			db.incrObjectField(`${utils.isNumber(topicData.cid) ? 'category' : 'categoryRemote'}:${topicData.cid}`, 'topic_count'),
			utils.isNumber(tid) ? db.incrObjectField('global', 'topicCount') : null,
			Topics.createTags(data.tags, topicData.tid, timestamp),
			scheduled ? Promise.resolve() : categories.updateRecentTid(topicData.cid, topicData.tid),
		]);
		if (scheduled) {
			await Topics.scheduled.pin(tid, topicData);
		}

		plugins.hooks.fire('action:topic.save', { topic: _.clone(topicData), data: data });
		return topicData.tid;
	};

	Topics.post = async function (data) {
		data = await plugins.hooks.fire('filter:topic.post', data);
		const { uid } = data;
		const remoteUid = activitypub.helpers.isUri(uid);

		const [categoryExists, canCreate, canTag, isAdmin] = await Promise.all([
			parseInt(data.cid, 10) > 0 ? categories.exists(data.cid) : true,
			privileges.categories.can('topics:create', data.cid, remoteUid ? -2 : uid),
			privileges.categories.can('topics:tag', data.cid, remoteUid ? -2 : uid),
			privileges.users.isAdministrator(uid),
		]);

		data.title = String(data.title).trim();
		data.tags = data.tags || [];
		data.content = String(data.content || '').trimEnd();
		if (!isAdmin) {
			Topics.checkTitle(data.title);
		}

		await Topics.validateTags(data.tags, data.cid, uid);
		data.tags = await Topics.filterTags(data.tags, data.cid);
		if (!data.fromQueue && !isAdmin) {
			Topics.checkContent(data.sourceContent || data.content);
			if (!await posts.canUserPostContentWithLinks(uid, data.content)) {
				throw new Error(`[[error:not-enough-reputation-to-post-links, ${meta.config['min:rep:post-links']}]]`);
			}
		}

		if (!categoryExists) {
			throw new Error('[[error:no-category]]');
		}

		if (!canCreate || (!canTag && data.tags.length)) {
			throw new Error('[[error:no-privileges]]');
		}

		await guestHandleValid(data);
		if (!data.fromQueue) {
			await user.isReadyToPost(uid, data.cid);
		}

		const tid = await Topics.create(data);

		let postData = data;
		postData.tid = tid;
		postData.ip = data.req ? data.req.ip : null;
		postData.isMain = true;
		postData = await posts.create(postData);
		postData = await onNewPost(postData, data);

		const [settings, topics] = await Promise.all([
			user.getSettings(uid),
			Topics.getTopicsByTids([postData.tid], uid),
		]);

		if (!Array.isArray(topics) || !topics.length) {
			throw new Error('[[error:no-topic]]');
		}

		if (utils.isNumber(uid) && uid > 0 && settings.followTopicsOnCreate) {
			await Topics.follow(postData.tid, uid);
		}
		const topicData = topics[0];
		topicData.unreplied = true;
		topicData.mainPost = postData;
		topicData.index = 0;
		postData.index = 0;

		if (topicData.scheduled) {
			await Topics.delete(tid);
		}

		analytics.increment(['topics', `topics:byCid:${topicData.cid}`]);
		plugins.hooks.fire('action:topic.post', { topic: topicData, post: postData, data: data });

		if (!topicData.scheduled) {
			setImmediate(async () => {
				try {
					if (utils.isNumber(uid)) {
						// New topic notifications only sent for local-to-local follows only
						await user.notifications.sendTopicNotificationToFollowers(uid, topicData, postData);
					}

					await Topics.notifyTagFollowers(postData, uid);
					await categories.notifyCategoryFollowers(postData, uid);
				} catch (err) {
					winston.error(err.stack);
				}
			});
		}

		return {
			topicData: topicData,
			postData: postData,
		};
	};

	Topics.reply = async function (data) {
		data = await plugins.hooks.fire('filter:topic.reply', data);
		const { tid, uid } = data;

		const [topicData, isAdmin] = await Promise.all([
			Topics.getTopicData(tid),
			privileges.users.isAdministrator(uid),
		]);

		await canReply(data, topicData);

		data.cid = topicData.cid;

		await guestHandleValid(data);
		data.content = String(data.content || '').trimEnd();

		if (!data.fromQueue && !isAdmin) {
			await user.isReadyToPost(uid, data.cid);
			Topics.checkContent(data.sourceContent || data.content);
			if (!await posts.canUserPostContentWithLinks(uid, data.content)) {
				throw new Error(`[[error:not-enough-reputation-to-post-links, ${meta.config['min:rep:post-links']}]]`);
			}
		}

		// For replies to scheduled topics, don't have a timestamp older than topic's itself
		if (topicData.scheduled) {
			data.timestamp = topicData.lastposttime + 1;
		}

		data.ip = data.req ? data.req.ip : null;
		let postData = await posts.create(data);
		postData = await onNewPost(postData, data);

		const settings = await user.getSettings(uid);
		if (uid > 0 && settings.followTopicsOnReply) {
			await Topics.follow(postData.tid, uid);
		}

		if (parseInt(uid, 10) || activitypub.helpers.isUri(uid)) {
			user.setUserField(uid, 'lastonline', Date.now());
		}

		if (parseInt(uid, 10) || activitypub.helpers.isUri(uid) || meta.config.allowGuestReplyNotifications) {
			setImmediate(async () => {
				try {
					await Topics.notifyFollowers(postData, uid, {
						type: 'new-reply',
						bodyShort: translator.compile('notifications:user-posted-to', postData.user.displayname, postData.topic.title),
						nid: `new_post:tid:${postData.topic.tid}:pid:${postData.pid}:uid:${uid}`,
						mergeId: `notifications:user-posted-to|${postData.topic.tid}`,
					});
				} catch (err) {
					winston.error(err.stack);
				}
			});
		}

		analytics.increment(['posts', `posts:byCid:${data.cid}`]);
		plugins.hooks.fire('action:topic.reply', { post: _.clone(postData), data: data });

		return postData;
	};

	async function onNewPost({ pid, tid, uid: postOwner }, { uid, handle }) {
		const [[postData], [userInfo]] = await Promise.all([
			posts.getPostSummaryByPids([pid], uid, { extraFields: ['attachments'] }),
			posts.getUserInfoForPosts([postOwner], uid),
		]);
		await Promise.all([
			Topics.addParentPosts([postData], uid),
			Topics.syncBacklinks(postData),
			Topics.markAsRead([tid], uid),
		]);

		// Returned data is a superset of post summary data
		postData.user = userInfo;
		postData.index = postData.topic.postcount - 1;
		postData.bookmarked = false;
		postData.display_edit_tools = true;
		postData.display_delete_tools = true;
		postData.display_moderator_tools = true;
		postData.display_move_tools = true;
		postData.selfPost = false;
		posts.overrideGuestHandle(postData, handle);
		return postData;
	}

	Topics.checkTitle = function (title) {
		check(title, meta.config.minimumTitleLength, meta.config.maximumTitleLength, 'title-too-short', 'title-too-long');
	};

	Topics.checkContent = function (content) {
		check(content, meta.config.minimumPostLength, meta.config.maximumPostLength, 'content-too-short', 'content-too-long');
	};

	function check(item, min, max, minError, maxError) {
		// Trim and remove HTML (latter for composers that send in HTML, like redactor)
		if (typeof item === 'string') {
			item = utils.stripHTMLTags(item).trim();
		}

		if (item === null || item === undefined || item.length < parseInt(min, 10)) {
			throw new Error(`[[error:${minError}, ${min}]]`);
		} else if (item.length > parseInt(max, 10)) {
			throw new Error(`[[error:${maxError}, ${max}]]`);
		}
	}

	async function guestHandleValid(data) {
		if (meta.config.allowGuestHandles && parseInt(data.uid, 10) === 0 && data.handle) {
			if (data.handle.length > meta.config.maximumUsernameLength) {
				throw new Error('[[error:guest-handle-invalid]]');
			}
			const exists = await user.existsBySlug(slugify(data.handle));
			if (exists) {
				throw new Error('[[error:username-taken]]');
			}
		}
	}

	async function canReply(data, topicData) {
		if (!topicData) {
			throw new Error('[[error:no-topic]]');
		}
		const { tid, uid } = data;
		const { cid, deleted, locked, scheduled } = topicData;

		const [canReply, canSchedule, isAdminOrMod] = await Promise.all([
			privileges.topics.can('topics:reply', tid, uid),
			privileges.topics.can('topics:schedule', tid, uid),
			privileges.categories.isAdminOrMod(cid, uid),
		]);

		if (locked && !isAdminOrMod) {
			throw new Error('[[error:topic-locked]]');
		}

		if (!scheduled && deleted && !isAdminOrMod) {
			throw new Error('[[error:topic-deleted]]');
		}

		if (scheduled && !canSchedule) {
			throw new Error('[[error:no-privileges]]');
		}

		if (!canReply) {
			throw new Error('[[error:no-privileges]]');
		}
	}
};
