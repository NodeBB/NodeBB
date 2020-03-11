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

	let topics = await Topics.getTopicsData(tids);

	const uids = _.uniq(topics.map(t => t && t.uid && t.uid.toString()).filter(v => utils.isNumber(v)));
	const cids = _.uniq(topics.map(t => t && t.cid && t.cid.toString()).filter(v => utils.isNumber(v)));

	const [
		callerSettings,
		users,
		userSettings,
		categoriesData,
		hasRead,
		isIgnored,
		bookmarks,
		teasers,
		tags,
	] = await Promise.all([
		user.getSettings(uid),
		user.getUsersFields(uids, ['uid', 'username', 'fullname', 'userslug', 'reputation', 'postcount', 'picture', 'signature', 'banned', 'status']),
		user.getMultipleUserSettings(uids),
		categories.getCategoriesFields(cids, ['cid', 'name', 'slug', 'icon', 'image', 'imageClass', 'bgColor', 'color', 'disabled']),
		Topics.hasReadTopics(tids, uid),
		Topics.isIgnoring(tids, uid),
		Topics.getUserBookmarks(tids, uid),
		Topics.getTeasers(topics, options),
		Topics.getTopicsTagsObjects(tids),
	]);

	users.forEach(function (user, index) {
		if (meta.config.hideFullname || !userSettings[index].showfullname) {
			user.fullname = undefined;
		}
	});

	const usersMap = _.zipObject(uids, users);
	const categoriesMap = _.zipObject(cids, categoriesData);
	const sortOldToNew = callerSettings.topicPostSort === 'newest_to_oldest';
	for (var i = 0; i < topics.length; i += 1) {
		if (topics[i]) {
			topics[i].category = categoriesMap[topics[i].cid];
			topics[i].user = usersMap[topics[i].uid];
			topics[i].teaser = teasers[i];
			topics[i].tags = tags[i];

			topics[i].isOwner = topics[i].uid === parseInt(uid, 10);
			topics[i].ignored = isIgnored[i];
			topics[i].unread = !hasRead[i] && !isIgnored[i];
			topics[i].bookmark = sortOldToNew ? Math.max(1, topics[i].postcount + 2 - bookmarks[i]) : bookmarks[i];
			topics[i].unreplied = !topics[i].teaser;

			topics[i].icons = [];
		}
	}

	topics = topics.filter(topic => topic && topic.category && !topic.category.disabled);

	const result = await plugins.fireHook('filter:topics.get', { topics: topics, uid: uid });
	return result.topics;
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
	if (stop > 0) {
		stop -= 1;
		if (start > 0) {
			start -= 1;
		}
	}
	const pids = await posts.getPidsFromSet(set, start, stop, reverse);
	if (!pids.length && !topic.mainPid) {
		return [];
	}

	if (parseInt(topic.mainPid, 10) && start === 0) {
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

	Topics.calculatePostIndices(replies, start);

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

Topics.async = require('../promisify')(Topics);
