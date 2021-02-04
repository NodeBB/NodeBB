'use strict';

const db = require('../database');
const topics = require('../topics');
const plugins = require('../plugins');
const meta = require('../meta');
const user = require('../user');

module.exports = function (Categories) {
	Categories.getCategoryTopics = async function (data) {
		let results = await plugins.hooks.fire('filter:category.topics.prepare', data);
		const tids = await Categories.getTopicIds(results);
		let topicsData = await topics.getTopicsByTids(tids, data.uid);
		topicsData = await user.blocks.filter(data.uid, topicsData);

		if (!topicsData.length) {
			return { topics: [], uid: data.uid };
		}
		topics.calculateTopicIndices(topicsData, data.start);

		results = await plugins.hooks.fire('filter:category.topics.get', { cid: data.cid, topics: topicsData, uid: data.uid });
		return { topics: results.topics, nextStart: data.stop + 1 };
	};

	Categories.getTopicIds = async function (data) {
		const dataForPinned = { ...data };
		dataForPinned.start = 0;
		dataForPinned.stop = -1;

		const [pinnedTids, set, direction] = await Promise.all([
			Categories.getPinnedTids(dataForPinned),
			Categories.buildTopicsSortedSet(data),
			Categories.getSortedSetRangeDirection(data.sort),
		]);

		const totalPinnedCount = pinnedTids.length;
		const pinnedTidsOnPage = pinnedTids.slice(data.start, data.stop !== -1 ? data.stop + 1 : undefined);
		const pinnedCountOnPage = pinnedTidsOnPage.length;
		const topicsPerPage = data.stop - data.start + 1;
		const normalTidsToGet = Math.max(0, topicsPerPage - pinnedCountOnPage);

		if (!normalTidsToGet && data.stop !== -1) {
			return pinnedTidsOnPage;
		}

		if (plugins.hooks.hasListeners('filter:categories.getTopicIds')) {
			const result = await plugins.hooks.fire('filter:categories.getTopicIds', {
				tids: [],
				data: data,
				pinnedTids: pinnedTidsOnPage,
				allPinnedTids: pinnedTids,
				totalPinnedCount: totalPinnedCount,
				normalTidsToGet: normalTidsToGet,
			});
			return result && result.tids;
		}

		let start = data.start;
		if (start > 0 && totalPinnedCount) {
			start -= totalPinnedCount - pinnedCountOnPage;
		}

		const stop = data.stop === -1 ? data.stop : start + normalTidsToGet - 1;
		let normalTids;
		const reverse = direction === 'highest-to-lowest';
		if (Array.isArray(set)) {
			const weights = set.map((s, index) => (index ? 0 : 1));
			normalTids = await db[reverse ? 'getSortedSetRevIntersect' : 'getSortedSetIntersect']({ sets: set, start: start, stop: stop, weights: weights });
		} else {
			normalTids = await db[reverse ? 'getSortedSetRevRange' : 'getSortedSetRange'](set, start, stop);
		}
		normalTids = normalTids.filter(tid => !pinnedTids.includes(tid));
		return pinnedTidsOnPage.concat(normalTids);
	};

	Categories.getTopicCount = async function (data) {
		if (plugins.hooks.hasListeners('filter:categories.getTopicCount')) {
			const result = await plugins.hooks.fire('filter:categories.getTopicCount', {
				topicCount: data.category.topic_count,
				data: data,
			});
			return result && result.topicCount;
		}
		const set = await Categories.buildTopicsSortedSet(data);
		if (Array.isArray(set)) {
			return await db.sortedSetIntersectCard(set);
		} else if (data.targetUid && set) {
			return await db.sortedSetCard(set);
		}
		return data.category.topic_count;
	};

	Categories.buildTopicsSortedSet = async function (data) {
		const cid = data.cid;
		let set = `cid:${cid}:tids`;
		const sort = data.sort || (data.settings && data.settings.categoryTopicSort) || meta.config.categoryTopicSort || 'newest_to_oldest';

		if (sort === 'most_posts') {
			set = `cid:${cid}:tids:posts`;
		} else if (sort === 'most_votes') {
			set = `cid:${cid}:tids:votes`;
		}

		if (data.targetUid) {
			set = `cid:${cid}:uid:${data.targetUid}:tids`;
		}

		if (data.tag) {
			if (Array.isArray(data.tag)) {
				set = [set].concat(data.tag.map(tag => `tag:${tag}:topics`));
			} else {
				set = [set, `tag:${data.tag}:topics`];
			}
		}
		const result = await plugins.hooks.fire('filter:categories.buildTopicsSortedSet', {
			set: set,
			data: data,
		});
		return result && result.set;
	};

	Categories.getSortedSetRangeDirection = async function (sort) {
		sort = sort || 'newest_to_oldest';
		const direction = sort === 'newest_to_oldest' || sort === 'most_posts' || sort === 'most_votes' ? 'highest-to-lowest' : 'lowest-to-highest';
		const result = await plugins.hooks.fire('filter:categories.getSortedSetRangeDirection', {
			sort: sort,
			direction: direction,
		});
		return result && result.direction;
	};

	Categories.getAllTopicIds = async function (cid, start, stop) {
		return await db.getSortedSetRange([`cid:${cid}:tids:pinned`, `cid:${cid}:tids`], start, stop);
	};

	Categories.getPinnedTids = async function (data) {
		if (plugins.hooks.hasListeners('filter:categories.getPinnedTids')) {
			const result = await plugins.hooks.fire('filter:categories.getPinnedTids', {
				pinnedTids: [],
				data: data,
			});
			return result && result.pinnedTids;
		}
		const pinnedTids = await db.getSortedSetRevRange(`cid:${data.cid}:tids:pinned`, data.start, data.stop);
		return await topics.tools.checkPinExpiry(pinnedTids);
	};

	Categories.modifyTopicsByPrivilege = function (topics, privileges) {
		if (!Array.isArray(topics) || !topics.length || privileges.isAdminOrMod) {
			return;
		}

		topics.forEach((topic) => {
			if (topic.deleted && !topic.isOwner) {
				topic.title = '[[topic:topic_is_deleted]]';
				topic.slug = topic.tid;
				topic.teaser = null;
				topic.noAnchor = true;
				topic.tags = [];
			}
		});
	};

	Categories.onNewPostMade = async function (cid, pinned, postData) {
		if (!cid || !postData) {
			return;
		}
		const promises = [
			db.sortedSetAdd(`cid:${cid}:pids`, postData.timestamp, postData.pid),
			db.incrObjectField(`category:${cid}`, 'post_count'),
		];
		if (!pinned) {
			promises.push(db.sortedSetIncrBy(`cid:${cid}:tids:posts`, 1, postData.tid));
		}
		await Promise.all(promises);
		await Categories.updateRecentTidForCid(cid);
	};
};
