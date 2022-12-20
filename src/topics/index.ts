'use strict';

import _ from 'lodash';
import validator from 'validator';
console.log(0);
import db from '../database';
console.log('D 1');
import posts from '../posts';
console.log('P 2');
import utils from '../utils';
import plugins from '../plugins';
import meta from '../meta';
import user from '../user';
import categories from '../categories';
import privileges from '../privileges';
import social from '../social';

const Topics = {} as any;

import data from './data';
import create from './create';
import deleteTopic from './delete';
import sorted from './sorted';
import unread from './unread';
import recent from './recent';
import userFn from './user';
import fork from './fork';
console.log(1);
import postsFn from './posts';
console.log(2);
import follow from './follow';
import tags from './tags';
import teaser from './teaser';
import suggested from './suggested';
import tools from './tools';
import bookmarks from './bookmarks';
import merge from './merge';
import scheduled from './scheduled';
import thumbs from './thumbs';
import events from './events';

data(Topics);
create(Topics);
deleteTopic(Topics);
sorted(Topics);
unread(Topics);
recent(Topics);
userFn(Topics);
fork(Topics);
postsFn(Topics);
follow(Topics);
tags(Topics);
teaser(Topics);
Topics.scheduled = scheduled;
suggested(Topics);
tools(Topics);
Topics.thumbs = thumbs;
bookmarks(Topics);
merge(Topics);
Topics.events = events;

Topics.exists = async function (tids) {
	return await db.exists(
		Array.isArray(tids) ? tids.map(tid => `topic:${tid}`) : `topic:${tids}`
	);
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

		async function loadShowfullnameSettings() {
			if (meta.config.hideFullname) {
				return uids.map(() => ({ showfullname: false }));
			}
			const data = await db.getObjectsFields(uids.map(uid => `user:${uid}:settings`), ['showfullname']);
			data.forEach((settings) => {
				settings.showfullname = parseInt(settings.showfullname, 10) === 1;
			});
			return data;
		}

		const [teasers, users, userSettings, categoriesData, guestHandles, thumbs] = await Promise.all([
			Topics.getTeasers(topics, options),
			user.getUsersFields(uids, ['uid', 'username', 'fullname', 'userslug', 'reputation', 'postcount', 'picture', 'signature', 'banned', 'status']),
			loadShowfullnameSettings(),
			categories.getCategoriesFields(cids, ['cid', 'name', 'slug', 'icon', 'backgroundImage', 'imageClass', 'bgColor', 'color', 'disabled']),
			loadGuestHandles(),
			Topics.thumbs.load(topics),
		]);

		users.forEach((userObj, idx) => {
			// Hide fullname if needed
			if (!userSettings[idx].showfullname) {
				userObj.fullname = undefined;
			}
		});

		return {
			topics,
			teasers,
			usersMap: _.zipObject(uids, users),
			categoriesMap: _.zipObject(cids, categoriesData),
			tidToGuestHandle: _.zipObject(guestTopics.map(t => t.tid), guestHandles),
			thumbs,
		};
	}

	const [result, hasRead, isIgnored, bookmarks, callerSettings] = await Promise.all([
		loadTopics(),
		Topics.hasReadTopics(tids, uid),
		Topics.isIgnoring(tids, uid),
		Topics.getUserBookmarks(tids, uid),
		user.getSettings(uid),
	]);

	const sortNewToOld = callerSettings.topicPostSort === 'newest_to_oldest';
	result.topics.forEach((topic, i) => {
		if (topic) {
			topic.thumbs = result.thumbs[i];
			topic.category = result.categoriesMap[topic.cid];
			topic.user = topic.uid ? result.usersMap[topic.uid] : { ...result.usersMap[topic.uid] };
			if (result.tidToGuestHandle[topic.tid]) {
				topic.user.username = validator.escape(result.tidToGuestHandle[topic.tid]);
				topic.user.displayname = topic.user.username;
			}
			topic.teaser = result.teasers[i] || null;
			topic.isOwner = topic.uid === parseInt(uid, 10);
			topic.ignored = isIgnored[i];
			topic.unread = parseInt(uid, 10) <= 0 || (!hasRead[i] && !isIgnored[i]);
			topic.bookmark = sortNewToOld ?
				Math.max(1, topic.postcount + 2 - bookmarks[i]) :
				Math.min(topic.postcount, bookmarks[i] + 1);
			topic.unreplied = !topic.teaser;

			topic.icons = [];
		}
	});

	const filteredTopics = result.topics.filter(topic => topic && topic.category && !topic.category.disabled);

	const hookResult = await plugins.hooks.fire('filter:topics.get', { topics: filteredTopics, uid: uid });
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
		thumbs,
		events,
	] = await Promise.all([
		Topics.getTopicPosts(topicData, set, start, stop, uid, reverse),
		categories.getCategoryData(topicData.cid),
		categories.getTagWhitelist([topicData.cid]),
		plugins.hooks.fire('filter:topic.thread_tools', { topic: topicData, uid: uid, tools: [] }),
		Topics.getFollowData([topicData.tid], uid),
		Topics.getUserBookmark(topicData.tid, uid),
		social.getActivePostSharing(),
		getDeleter(topicData),
		getMerger(topicData),
		Topics.getRelatedTopics(topicData, uid),
		Topics.thumbs.load([topicData]),
		Topics.events.get(topicData.tid, uid, reverse),
	]);

	topicData.thumbs = thumbs[0];
	topicData.posts = posts;
	topicData.events = events;
	topicData.posts.forEach((p) => {
		p.events = events.filter(
			event => event.timestamp >= p.eventStart && event.timestamp < p.eventEnd
		);
		p.eventStart = undefined;
		p.eventEnd = undefined;
	});

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

	const result = await plugins.hooks.fire('filter:topic.get', { topic: topicData, uid: uid });
	return result.topic;
};

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
	let postData = await posts.getPostsByPids(mainPids, uid);
	postData = await user.blocks.filter(uid, postData);
	postData.forEach((post) => {
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
	if (!tid || !term) {
		throw new Error('[[error:invalid-data]]');
	}
	const result = await plugins.hooks.fire('filter:topic.search', {
		tid: tid,
		term: term,
		ids: [],
	});
	return Array.isArray(result) ? result : result.ids;
};

import promisify from '../promisify';
promisify(Topics);

export default Topics;