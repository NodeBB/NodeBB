'use strict';

const db = require('../database');
const topics = require('../topics');
const plugins = require('../plugins');
const meta = require('../meta');
const privileges = require('../privileges');
const user = require('../user');
const notifications = require('../notifications');
const translator = require('../translator');
const batch = require('../batch');

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
		const [pinnedTids, set] = await Promise.all([
			Categories.getPinnedTids({ ...data, start: 0, stop: -1 }),
			Categories.buildTopicsSortedSet(data),
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

		let { start } = data;
		if (start > 0 && totalPinnedCount) {
			start -= totalPinnedCount - pinnedCountOnPage;
		}

		const stop = data.stop === -1 ? data.stop : start + normalTidsToGet - 1;
		let normalTids;
		if (Array.isArray(set)) {
			const weights = set.map((s, index) => (index ? 0 : 1));
			normalTids = await db.getSortedSetRevIntersect({ sets: set, start: start, stop: stop, weights: weights });
		} else {
			normalTids = await db.getSortedSetRevRange(set, start, stop);
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
		const { cid } = data;
		const sort = data.sort || (data.settings && data.settings.categoryTopicSort) || meta.config.categoryTopicSort || 'recently_replied';
		const sortToSet = {
			recently_replied: `cid:${cid}:tids`,
			recently_created: `cid:${cid}:tids:create`,
			most_posts: `cid:${cid}:tids:posts`,
			most_votes: `cid:${cid}:tids:votes`,
			most_views: `cid:${cid}:tids:views`,
		};

		let set = sortToSet.hasOwnProperty(sort) ? sortToSet[sort] : `cid:${cid}:tids`;

		if (data.tag) {
			if (Array.isArray(data.tag)) {
				set = [set].concat(data.tag.map(tag => `tag:${tag}:topics`));
			} else {
				set = [set, `tag:${data.tag}:topics`];
			}
		}

		if (data.targetUid) {
			set = (Array.isArray(set) ? set : [set]).concat([`cid:${cid}:uid:${data.targetUid}:tids`]);
		}

		const result = await plugins.hooks.fire('filter:categories.buildTopicsSortedSet', {
			set: set,
			data: data,
		});
		return result && result.set;
	};

	Categories.getSortedSetRangeDirection = async function (sort) {
		console.warn('[deprecated] Will be removed in 4.x');
		sort = sort || 'recently_replied';
		const direction = ['newest_to_oldest', 'most_posts', 'most_votes', 'most_views'].includes(sort) ? 'highest-to-lowest' : 'lowest-to-highest';
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
		const [allPinnedTids, canSchedule] = await Promise.all([
			db.getSortedSetRevRange(`cid:${data.cid}:tids:pinned`, data.start, data.stop),
			privileges.categories.can('topics:schedule', data.cid, data.uid),
		]);
		const pinnedTids = canSchedule ? allPinnedTids : await filterScheduledTids(allPinnedTids);

		return await topics.tools.checkPinExpiry(pinnedTids);
	};

	Categories.modifyTopicsByPrivilege = function (topics, privileges) {
		if (!Array.isArray(topics) || !topics.length || privileges.view_deleted) {
			return;
		}

		topics.forEach((topic) => {
			if (!topic.scheduled && topic.deleted && !topic.isOwner) {
				topic.title = '[[topic:topic-is-deleted]]';
				if (topic.hasOwnProperty('titleRaw')) {
					topic.titleRaw = '[[topic:topic-is-deleted]]';
				}
				topic.slug = topic.tid;
				topic.teaser = null;
				topic.noAnchor = true;
				topic.unread = false;
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

	Categories.onTopicsMoved = async (cids) => {
		await Promise.all(cids.map(async (cid) => {
			await Promise.all([
				Categories.setCategoryField(
					cid, 'topic_count', await db.sortedSetCard(`cid:${cid}:tids:lastposttime`)
				),
				Categories.setCategoryField(
					cid, 'post_count', await db.sortedSetCard(`cid:${cid}:pids`)
				),
				Categories.updateRecentTidForCid(cid),
			]);
		}));
	};

	async function filterScheduledTids(tids) {
		const scores = await db.sortedSetScores('topics:scheduled', tids);
		const now = Date.now();
		return tids.filter((tid, index) => tid && (!scores[index] || scores[index] <= now));
	}

	Categories.notifyCategoryFollowers = async (postData, exceptUid) => {
		const { cid } = postData.topic;
		const followers = [];
		await batch.processSortedSet(`cid:${cid}:uid:watch:state`, async (uids) => {
			followers.push(
				...await privileges.categories.filterUids('topics:read', cid, uids)
			);
		}, {
			batch: 500,
			min: Categories.watchStates.watching,
			max: Categories.watchStates.watching,
		});
		const index = followers.indexOf(String(exceptUid));
		if (index !== -1) {
			followers.splice(index, 1);
		}
		if (!followers.length) {
			return;
		}

		const { displayname } = postData.user;
		const categoryName = await Categories.getCategoryField(cid, 'name');
		const notifBase = 'notifications:user-posted-topic-in-category';

		const bodyShort = translator.compile(notifBase, displayname, categoryName);

		const notification = await notifications.create({
			type: 'new-topic-in-category',
			nid: `new_topic:tid:${postData.topic.tid}:uid:${exceptUid}`,
			bodyShort: bodyShort,
			bodyLong: postData.content,
			pid: postData.pid,
			path: `/post/${postData.pid}`,
			tid: postData.topic.tid,
			from: exceptUid,
		});
		notifications.push(notification, followers);
	};
};
