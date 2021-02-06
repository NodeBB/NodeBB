
'use strict';

const _ = require('lodash');
const validator = require('validator');

const db = require('../database');
const utils = require('../utils');
const slugify = require('../slugify');
const plugins = require('../plugins');
const analytics = require('../analytics');
const user = require('../user');
const meta = require('../meta');
const posts = require('../posts');
const privileges = require('../privileges');
const categories = require('../categories');
const translator = require('../translator');

module.exports = function (Topics) {
	Topics.create = async function (data) {
		// This is an internal method, consider using Topics.post instead
		const timestamp = data.timestamp || Date.now();

		const tid = await db.incrObjectField('global', 'nextTid');

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
		const result = await plugins.hooks.fire('filter:topic.create', { topic: topicData, data: data });
		topicData = result.topic;
		await db.setObject(`topic:${topicData.tid}`, topicData);

		await Promise.all([
			db.sortedSetsAdd([
				'topics:tid',
				`cid:${topicData.cid}:tids`,
				`cid:${topicData.cid}:uid:${topicData.uid}:tids`,
			], timestamp, topicData.tid),
			db.sortedSetsAdd([
				'topics:views', 'topics:posts', 'topics:votes',
				`cid:${topicData.cid}:tids:votes`,
				`cid:${topicData.cid}:tids:posts`,
			], 0, topicData.tid),
			categories.updateRecentTid(topicData.cid, topicData.tid),
			user.addTopicIdToUser(topicData.uid, topicData.tid, timestamp),
			db.incrObjectField(`category:${topicData.cid}`, 'topic_count'),
			db.incrObjectField('global', 'topicCount'),
			Topics.createTags(data.tags, topicData.tid, timestamp),
		]);

		plugins.hooks.fire('action:topic.save', { topic: _.clone(topicData), data: data });
		return topicData.tid;
	};

	Topics.post = async function (data) {
		const { uid } = data;
		data.title = String(data.title).trim();
		data.tags = data.tags || [];
		if (data.content) {
			data.content = utils.rtrim(data.content);
		}
		Topics.checkTitle(data.title);
		await Topics.validateTags(data.tags, data.cid);
		Topics.checkContent(data.content);

		const [categoryExists, canCreate, canTag] = await Promise.all([
			categories.exists(data.cid),
			privileges.categories.can('topics:create', data.cid, data.uid),
			privileges.categories.can('topics:tag', data.cid, data.uid),
		]);

		if (!categoryExists) {
			throw new Error('[[error:no-category]]');
		}

		if (!canCreate || (!canTag && data.tags.length)) {
			throw new Error('[[error:no-privileges]]');
		}

		await guestHandleValid(data);
		if (!data.fromQueue) {
			await user.isReadyToPost(data.uid, data.cid);
		}
		const filteredData = await plugins.hooks.fire('filter:topic.post', data);
		data = filteredData;
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

		if (settings.followTopicsOnCreate) {
			await Topics.follow(postData.tid, uid);
		}
		const topicData = topics[0];
		topicData.unreplied = true;
		topicData.mainPost = postData;
		topicData.index = 0;
		postData.index = 0;

		analytics.increment(['topics', `topics:byCid:${topicData.cid}`]);
		plugins.hooks.fire('action:topic.post', { topic: topicData, post: postData, data: data });

		if (parseInt(uid, 10)) {
			user.notifications.sendTopicNotificationToFollowers(uid, topicData, postData);
		}

		return {
			topicData: topicData,
			postData: postData,
		};
	};

	Topics.reply = async function (data) {
		const { tid } = data;
		const { uid } = data;

		const topicData = await Topics.getTopicData(tid);
		if (!topicData) {
			throw new Error('[[error:no-topic]]');
		}

		data.cid = topicData.cid;

		const [canReply, isAdminOrMod] = await Promise.all([
			privileges.topics.can('topics:reply', tid, uid),
			privileges.categories.isAdminOrMod(data.cid, uid),
		]);

		if (topicData.locked && !isAdminOrMod) {
			throw new Error('[[error:topic-locked]]');
		}

		if (topicData.deleted && !isAdminOrMod) {
			throw new Error('[[error:topic-deleted]]');
		}

		if (!canReply) {
			throw new Error('[[error:no-privileges]]');
		}

		await guestHandleValid(data);
		if (!data.fromQueue) {
			await user.isReadyToPost(uid, data.cid);
		}
		await plugins.hooks.fire('filter:topic.reply', data);
		if (data.content) {
			data.content = utils.rtrim(data.content);
		}
		Topics.checkContent(data.content);

		data.ip = data.req ? data.req.ip : null;
		let postData = await posts.create(data);
		postData = await onNewPost(postData, data);

		const settings = await user.getSettings(uid);
		if (settings.followTopicsOnReply) {
			await Topics.follow(postData.tid, uid);
		}

		if (parseInt(uid, 10)) {
			user.setUserField(uid, 'lastonline', Date.now());
		}

		if (parseInt(uid, 10) || meta.config.allowGuestReplyNotifications) {
			Topics.notifyFollowers(postData, uid, {
				type: 'new-reply',
				bodyShort: translator.compile('notifications:user_posted_to', postData.user.username, postData.topic.title),
				nid: `new_post:tid:${postData.topic.tid}:pid:${postData.pid}:uid:${uid}`,
				mergeId: `notifications:user_posted_to|${postData.topic.tid}`,
			});
		}

		analytics.increment(['posts', `posts:byCid:${data.cid}`]);
		plugins.hooks.fire('action:topic.reply', { post: _.clone(postData), data: data });

		return postData;
	};

	async function onNewPost(postData, data) {
		const { tid } = postData;
		const { uid } = postData;
		await Topics.markAsUnreadForAll(tid);
		await Topics.markAsRead([tid], uid);
		const [
			userInfo,
			topicInfo,
		] = await Promise.all([
			posts.getUserInfoForPosts([postData.uid], uid),
			Topics.getTopicFields(tid, ['tid', 'uid', 'title', 'slug', 'cid', 'postcount', 'mainPid']),
			Topics.addParentPosts([postData]),
			posts.parsePost(postData),
		]);

		postData.user = userInfo[0];
		postData.topic = topicInfo;
		postData.index = topicInfo.postcount - 1;

		// Username override for guests, if enabled
		if (meta.config.allowGuestHandles && postData.uid === 0 && data.handle) {
			postData.user.username = validator.escape(String(data.handle));
		}

		postData.votes = 0;
		postData.bookmarked = false;
		postData.display_edit_tools = true;
		postData.display_delete_tools = true;
		postData.display_moderator_tools = true;
		postData.display_move_tools = true;
		postData.selfPost = false;
		postData.timestampISO = utils.toISOString(postData.timestamp);
		postData.topic.title = String(postData.topic.title);

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
};
