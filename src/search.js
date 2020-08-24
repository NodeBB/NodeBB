'use strict';

const _ = require('lodash');

const db = require('./database');
const posts = require('./posts');
const topics = require('./topics');
const categories = require('./categories');
const user = require('./user');
const plugins = require('./plugins');
const privileges = require('./privileges');
const utils = require('./utils');

const search = module.exports;

search.search = async function (data) {
	const start = process.hrtime();
	data.searchIn = data.searchIn || 'titlesposts';
	data.sortBy = data.sortBy || 'relevance';

	let result;
	if (data.searchIn === 'posts' || data.searchIn === 'titles' || data.searchIn === 'titlesposts') {
		result = await searchInContent(data);
	} else if (data.searchIn === 'users') {
		result = await user.search(data);
	} else if (data.searchIn === 'tags') {
		result = await topics.searchAndLoadTags(data);
	} else {
		throw new Error('[[error:unknown-search-filter]]');
	}

	result.time = (process.elapsedTimeSince(start) / 1000).toFixed(2);
	return result;
};

async function searchInContent(data) {
	data.uid = data.uid || 0;

	const [searchCids, searchUids] = await Promise.all([
		getSearchCids(data),
		getSearchUids(data),
	]);

	async function doSearch(type, searchIn) {
		if (searchIn.includes(data.searchIn)) {
			return await plugins.fireHook('filter:search.query', {
				index: type,
				content: data.query,
				matchWords: data.matchWords || 'all',
				cid: searchCids,
				uid: searchUids,
				searchData: data,
			});
		}
		return [];
	}
	const [pids, tids] = await Promise.all([
		doSearch('post', ['posts', 'titlesposts']),
		doSearch('topic', ['titles', 'titlesposts']),
	]);

	if (data.returnIds) {
		return { pids: pids, tids: tids };
	}

	const mainPids = await topics.getMainPids(tids);

	let allPids = mainPids.concat(pids).filter(Boolean);

	allPids = await privileges.posts.filter('topics:read', allPids, data.uid);
	allPids = await filterAndSort(allPids, data);

	const metadata = await plugins.fireHook('filter:search.inContent', {
		pids: allPids,
	});

	const itemsPerPage = Math.min(data.itemsPerPage || 10, 100);
	const returnData = {
		posts: [],
		matchCount: metadata.pids.length,
		pageCount: Math.max(1, Math.ceil(parseInt(metadata.pids.length, 10) / itemsPerPage)),
	};

	if (data.page) {
		const start = Math.max(0, (data.page - 1)) * itemsPerPage;
		metadata.pids = metadata.pids.slice(start, start + itemsPerPage);
	}

	returnData.posts = await posts.getPostSummaryByPids(metadata.pids, data.uid, {});
	await plugins.fireHook('filter:search.contentGetResult', { result: returnData, data: data });
	delete metadata.pids;
	return Object.assign(returnData, metadata);
}

async function filterAndSort(pids, data) {
	if (data.sortBy === 'relevance' && !data.replies && !data.timeRange && !data.hasTags && !plugins.hasListeners('filter:search.filterAndSort')) {
		return pids;
	}
	let postsData = await getMatchedPosts(pids, data);
	if (!postsData.length) {
		return pids;
	}
	postsData = postsData.filter(Boolean);

	postsData = filterByPostcount(postsData, data.replies, data.repliesFilter);
	postsData = filterByTimerange(postsData, data.timeRange, data.timeFilter);
	postsData = filterByTags(postsData, data.hasTags);

	sortPosts(postsData, data);

	const result = await plugins.fireHook('filter:search.filterAndSort', { pids: pids, posts: postsData, data: data });
	return result.posts.map(post => post && post.pid);
}

async function getMatchedPosts(pids, data) {
	const postFields = ['pid', 'uid', 'tid', 'timestamp', 'deleted', 'upvotes', 'downvotes'];

	let postsData = await posts.getPostsFields(pids, postFields);
	postsData = postsData.filter(post => post && !post.deleted);
	const uids = _.uniq(postsData.map(post => post.uid));
	const tids = _.uniq(postsData.map(post => post.tid));

	const [users, topics] = await Promise.all([
		getUsers(uids, data),
		getTopics(tids, data),
	]);

	const tidToTopic = _.zipObject(tids, topics);
	const uidToUser = _.zipObject(uids, users);
	postsData.forEach(function (post) {
		if (topics && tidToTopic[post.tid]) {
			post.topic = tidToTopic[post.tid];
			if (post.topic && post.topic.category) {
				post.category = post.topic.category;
			}
		}

		if (uidToUser[post.uid]) {
			post.user = uidToUser[post.uid];
		}
	});

	return postsData.filter(post => post && post.topic && !post.topic.deleted);
}

async function getUsers(uids, data) {
	if (data.sortBy.startsWith('user')) {
		return user.getUsersFields(uids, ['username']);
	}
	return [];
}

async function getTopics(tids, data) {
	const topicsData = await topics.getTopicsData(tids);
	const cids = _.uniq(topicsData.map(topic => topic && topic.cid));
	const [categories, tags] = await Promise.all([
		getCategories(cids, data),
		getTags(tids, data),
	]);

	const cidToCategory = _.zipObject(cids, categories);
	topicsData.forEach(function (topic, index) {
		if (topic && categories && cidToCategory[topic.cid]) {
			topic.category = cidToCategory[topic.cid];
		}
		if (topic && tags && tags[index]) {
			topic.tags = tags[index];
		}
	});

	return topicsData;
}

async function getCategories(cids, data) {
	const categoryFields = [];

	if (data.sortBy.startsWith('category.')) {
		categoryFields.push(data.sortBy.split('.')[1]);
	}
	if (!categoryFields.length) {
		return null;
	}

	return await db.getObjectsFields(cids.map(cid => 'category:' + cid), categoryFields);
}

async function getTags(tids, data) {
	if (Array.isArray(data.hasTags) && data.hasTags.length) {
		return await topics.getTopicsTags(tids);
	}
	return null;
}

function filterByPostcount(posts, postCount, repliesFilter) {
	postCount = parseInt(postCount, 10);
	if (postCount) {
		if (repliesFilter === 'atleast') {
			posts = posts.filter(post => post.topic && post.topic.postcount >= postCount);
		} else {
			posts = posts.filter(post => post.topic && post.topic.postcount <= postCount);
		}
	}
	return posts;
}

function filterByTimerange(posts, timeRange, timeFilter) {
	timeRange = parseInt(timeRange, 10) * 1000;
	if (timeRange) {
		const time = Date.now() - timeRange;
		if (timeFilter === 'newer') {
			posts = posts.filter(post => post.timestamp >= time);
		} else {
			posts = posts.filter(post => post.timestamp <= time);
		}
	}
	return posts;
}

function filterByTags(posts, hasTags) {
	if (Array.isArray(hasTags) && hasTags.length) {
		posts = posts.filter(function (post) {
			var hasAllTags = false;
			if (post && post.topic && Array.isArray(post.topic.tags) && post.topic.tags.length) {
				hasAllTags = hasTags.every(tag => post.topic.tags.includes(tag));
			}
			return hasAllTags;
		});
	}
	return posts;
}

function sortPosts(posts, data) {
	if (!posts.length || data.sortBy === 'relevance') {
		return;
	}

	data.sortDirection = data.sortDirection || 'desc';
	const direction = data.sortDirection === 'desc' ? 1 : -1;
	const fields = data.sortBy.split('.');
	if (fields.length === 1) {
		return posts.sort((p1, p2) => direction * (p2[fields[0]] - p1[fields[0]]));
	}

	const firstPost = posts[0];
	if (!fields || fields.length !== 2 || !firstPost[fields[0]] || !firstPost[fields[0]][fields[1]]) {
		return;
	}

	const isNumeric = utils.isNumber(firstPost[fields[0]][fields[1]]);

	if (isNumeric) {
		posts.sort((p1, p2) => direction * (p2[fields[0]][fields[1]] - p1[fields[0]][fields[1]]));
	} else {
		posts.sort(function (p1, p2) {
			if (p1[fields[0]][fields[1]] > p2[fields[0]][fields[1]]) {
				return direction;
			} else if (p1[fields[0]][fields[1]] < p2[fields[0]][fields[1]]) {
				return -direction;
			}
			return 0;
		});
	}
}

async function getSearchCids(data) {
	if (!Array.isArray(data.categories) || !data.categories.length) {
		return [];
	}

	if (data.categories.includes('all')) {
		return await categories.getCidsByPrivilege('categories:cid', data.uid, 'read');
	}

	const [watchedCids, childrenCids] = await Promise.all([
		getWatchedCids(data),
		getChildrenCids(data),
	]);
	return _.uniq(watchedCids.concat(childrenCids).concat(data.categories).filter(Boolean));
}

async function getWatchedCids(data) {
	if (!data.categories.includes('watched')) {
		return [];
	}
	return await user.getCategoriesByStates(data.uid, [categories.watchStates.watching]);
}

async function getChildrenCids(data) {
	if (!data.searchChildren) {
		return [];
	}
	const childrenCids = await Promise.all(data.categories.map(cid => categories.getChildrenCids(cid)));
	return await privileges.categories.filterCids('find', _.uniq(_.flatten(childrenCids)), data.uid);
}

async function getSearchUids(data) {
	if (!data.postedBy) {
		return [];
	}
	return await user.getUidsByUsernames(Array.isArray(data.postedBy) ? data.postedBy : [data.postedBy]);
}

require('./promisify')(search);
