'use strict';

var _ = require('lodash');

var db = require('../database');
var posts = require('../posts');
var utils = require('../utils');
var plugins = require('../plugins');
var meta = require('../meta');
var user = require('../user');
var categories = require('../categories');
var privileges = require('../privileges');
var social = require('../social');

var Topics = module.exports;

require('./data')(Topics);
require('./create')(Topics);
require('./delete')(Topics);
require('./sorted')(Topics);
require('./unread')(Topics);
require('./recent')(Topics);
require('./user')(Topics);
require('./fork')(Topics);
require('./posts')(Topics);
require('./follow')(Topics);
require('./tags')(Topics);
require('./teaser')(Topics);
require('./suggested')(Topics);
require('./tools')(Topics);
require('./thumb')(Topics);
require('./bookmarks')(Topics);
require('./merge')(Topics);
require('./jobs')(Topics);

Topics.exists = async function (tid) {
	return await db.exists('topic:' + tid);
};

Topics.getTopicsFromSet = async function (set, uid, start, stop) {
	const tids = await db.getSortedSetRevRange(set, start, stop);
	const topics = await Topics.getTopics(tids, uid);
	Topics.calculateTopicIndices(topics, start);
	return { topics: topics, nextStart: stop + 1 };
};

Topics.getTopics = async function (tids, options) {
	let uid = options;
	if (typeof options === 'object') {
		uid = options.uid;
	}

	tids = await privileges.topics.filterTids('topics:read', tids, uid);
	return await Topics.getTopicsByTids(tids, options);
};

Topics.getTopicsByTids = async function (tids, options) {
	if (!Array.isArray(tids) || !tids.length) {
		return [];
	}
	let uid = options;
	if (typeof options === 'object') {
		uid = options.uid;
	}

	async function loadTopics() {
		const topics = await Topics.getTopicsData(tids);
		const uids = _.uniq(topics.map(t => t && t.uid && t.uid.toString()).filter(v => utils.isNumber(v)));
		const cids = _.uniq(topics.map(t => t && t.cid && t.cid.toString()).filter(v => utils.isNumber(v)));
		const guestTopics = topics.filter(t => t && t.uid === 0);

		async function loadGuestHandles() {
			const mainPids = guestTopics.map(t => t.mainPid);
			const postData = await posts.getPostsFields(mainPids, ['handle']);
			return postData.map(p => p.handle);
		}

		const [teasers, users, userSettings, categoriesData, guestHandles] = await Promise.all([
			Topics.getTeasers(topics, options),
			user.getUsersFields(uids, ['uid', 'username', 'fullname', 'userslug', 'reputation', 'postcount', 'picture', 'signature', 'banned', 'status']),
			user.getMultipleUserSettings(uids),
			categories.getCategoriesFields(cids, ['cid', 'name', 'slug', 'icon', 'backgroundImage', 'imageClass', 'bgColor', 'color', 'disabled']),
			loadGuestHandles(),
		]);

		users.forEach((userObj, idx) => {
			// Hide fullname if needed
			if (meta.config.hideFullname || !userSettings[idx].showfullname) {
				userObj.fullname = undefined;
			}
		});

		return {
			topics,
			teasers,
			usersMap: _.zipObject(uids, users),
			categoriesMap: _.zipObject(cids, categoriesData),
			tidToGuestHandle: _.zipObject(guestTopics.map(t => t.tid), guestHandles),
		};
	}

	const [result, tags, hasRead, isIgnored, bookmarks, callerSettings] = await Promise.all([
		loadTopics(),
		Topics.getTopicsTagsObjects(tids),
		Topics.hasReadTopics(tids, uid),
		Topics.isIgnoring(tids, uid),
		Topics.getUserBookmarks(tids, uid),
		user.getSettings(uid),
	]);

	const sortOldToNew = callerSettings.topicPostSort === 'newest_to_oldest';
	result.topics.forEach(function (topic, i) {
		if (topic) {
			topic.category = result.categoriesMap[topic.cid];
			topic.user = result.usersMap[topic.uid];
			if (result.tidToGuestHandle[topic.tid]) {
				topic.user.username = result.tidToGuestHandle[topic.tid];
			}
			topic.teaser = result.teasers[i] || null;
			topic.tags = tags[i];

			topic.isOwner = topic.uid === parseInt(uid, 10);
			topic.ignored = isIgnored[i];
			topic.unread = parseInt(uid, 10) > 0 && !hasRead[i] && !isIgnored[i];
			topic.bookmark = sortOldToNew ?
				Math.max(1, topic.postcount + 2 - bookmarks[i]) :
				Math.min(topic.postcount, bookmarks[i] + 1);
			topic.unreplied = !topic.teaser;

			topic.icons = [];
		}
	});

	const filteredTopics = result.topics.filter(topic => topic && topic.category && !topic.category.disabled);

	const hookResult = await plugins.fireHook('filter:topics.get', { topics: filteredTopics, uid: uid });
	return hookResult.topics;
};

Topics.getTopicWithPosts = async function (topicData, set, uid, start, stop, reverse) {
	const [
		posts,
		category,
		tagWhitelist,
		threadTools,
		followData,
		bookmark,
		postSharing,
		deleter,
		merger,
		related,
	] = await Promise.all([
		getMainPostAndReplies(topicData, set, uid, start, stop, reverse),
		categories.getCategoryData(topicData.cid),
		categories.getTagWhitelist([topicData.cid]),
		plugins.fireHook('filter:topic.thread_tools', { topic: topicData, uid: uid, tools: [] }),
		Topics.getFollowData([topicData.tid], uid),
		Topics.getUserBookmark(topicData.tid, uid),
		social.getActivePostSharing(),
		getDeleter(topicData),
		getMerger(topicData),
		getRelated(topicData, uid),
	]);

	topicData.posts = posts;
	topicData.category = category;
	topicData.tagWhitelist = tagWhitelist[0];
	topicData.minTags = category.minTags;
	topicData.maxTags = category.maxTags;
	topicData.thread_tools = threadTools.tools;
	topicData.isFollowing = followData[0].following;
	topicData.isNotFollowing = !followData[0].following && !followData[0].ignoring;
	topicData.isIgnoring = followData[0].ignoring;
	topicData.bookmark = bookmark;
	topicData.postSharing = postSharing;
	topicData.deleter = deleter;
	if (deleter) {
		topicData.deletedTimestampISO = utils.toISOString(topicData.deletedTimestamp);
	}
	topicData.merger = merger;
	if (merger) {
		topicData.mergedTimestampISO = utils.toISOString(topicData.mergedTimestamp);
	}
	topicData.related = related || [];
	topicData.unreplied = topicData.postcount === 1;
	topicData.icons = [];

	const result = await plugins.fireHook('filter:topic.get', { topic: topicData, uid: uid });
	return result.topic;
};

async function getMainPostAndReplies(topic, set, uid, start, stop, reverse) {
	let repliesStart = start;
	let repliesStop = stop;
	if (stop > 0) {
		repliesStop -= 1;
		if (start > 0) {
			repliesStart -= 1;
		}
	}
	const pids = await posts.getPidsFromSet(set, repliesStart, repliesStop, reverse);
	if (!pids.length && !topic.mainPid) {
		return [];
	}

	if (topic.mainPid && start === 0) {
		pids.unshift(topic.mainPid);
	}
	const postData = await posts.getPostsByPids(pids, uid);
	if (!postData.length) {
		return [];
	}
	var replies = postData;
	if (topic.mainPid && start === 0) {
		postData[0].index = 0;
		replies = postData.slice(1);
	}

	Topics.calculatePostIndices(replies, repliesStart);

	return await Topics.addPostData(postData, uid);
}

async function getDeleter(topicData) {
	if (!parseInt(topicData.deleterUid, 10)) {
		return null;
	}
	return await user.getUserFields(topicData.deleterUid, ['username', 'userslug', 'picture']);
}

async function getMerger(topicData) {
	if (!parseInt(topicData.mergerUid, 10)) {
		return null;
	}
	const [
		merger,
		mergedIntoTitle,
	] = await Promise.all([
		user.getUserFields(topicData.mergerUid, ['username', 'userslug', 'picture']),
		Topics.getTopicField(topicData.mergeIntoTid, 'title'),
	]);
	merger.mergedIntoTitle = mergedIntoTitle;
	return merger;
}

async function getRelated(topicData, uid) {
	const tags = await Topics.getTopicTagsObjects(topicData.tid);
	topicData.tags = tags;
	return await Topics.getRelatedTopics(topicData, uid);
}

Topics.getMainPost = async function (tid, uid) {
	const mainPosts = await Topics.getMainPosts([tid], uid);
	return Array.isArray(mainPosts) && mainPosts.length ? mainPosts[0] : null;
};

Topics.getMainPids = async function (tids) {
	if (!Array.isArray(tids) || !tids.length) {
		return [];
	}
	const topicData = await Topics.getTopicsFields(tids, ['mainPid']);
	return topicData.map(topic => topic && topic.mainPid);
};

Topics.getMainPosts = async function (tids, uid) {
	const mainPids = await Topics.getMainPids(tids);
	return await getMainPosts(mainPids, uid);
};

async function getMainPosts(mainPids, uid) {
	const postData = await posts.getPostsByPids(mainPids, uid);
	postData.forEach(function (post) {
		if (post) {
			post.index = 0;
		}
	});
	return await Topics.addPostData(postData, uid);
}

Topics.isLocked = async function (tid) {
	const locked = await Topics.getTopicField(tid, 'locked');
	return locked === 1;
};

Topics.search = async function (tid, term) {
	const pids = await plugins.fireHook('filter:topic.search', {
		tid: tid,
		term: term,
	});
	return Array.isArray(pids) ? pids : [];
};

require('../promisify')(Topics);
