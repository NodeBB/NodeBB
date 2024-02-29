
'use strict';

const db = require('../database');
const plugins = require('../plugins');
const posts = require('../posts');

module.exports = function (Topics) {
	const terms = {
		day: 86400000,
		week: 604800000,
		month: 2592000000,
		year: 31104000000,
	};

	Topics.getRecentTopics = async function (cid, uid, start, stop, filter) {
		return await Topics.getSortedTopics({
			cids: cid,
			uid: uid,
			start: start,
			stop: stop,
			filter: filter,
			sort: 'recent',
		});
	};

	/* not an orphan method, used in widget-essentials */
	Topics.getLatestTopics = async function (options) {
		// uid, start, stop, term
		const tids = await Topics.getLatestTidsFromSet('topics:recent', options.start, options.stop, options.term);
		const topics = await Topics.getTopics(tids, options);
		return { topics: topics, nextStart: options.stop + 1 };
	};

	Topics.getSinceFromTerm = function (term) {
		if (terms.hasOwnProperty(term)) {
			return terms[term];
		}
		return terms.day;
	};

	Topics.getLatestTidsFromSet = async function (set, start, stop, term) {
		const since = Topics.getSinceFromTerm(term);
		const count = parseInt(stop, 10) === -1 ? stop : stop - start + 1;
		return await db.getSortedSetRevRangeByScore(set, start, count, '+inf', Date.now() - since);
	};

	Topics.updateLastPostTimeFromLastPid = async function (tid) {
		const pid = await Topics.getLatestUndeletedPid(tid);
		if (!pid) {
			return;
		}
		const timestamp = await posts.getPostField(pid, 'timestamp');
		if (!timestamp) {
			return;
		}
		await Topics.updateLastPostTime(tid, timestamp);
	};

	Topics.updateLastPostTime = async function (tid, lastposttime) {
		await Topics.setTopicField(tid, 'lastposttime', lastposttime);
		const topicData = await Topics.getTopicFields(tid, ['cid', 'deleted', 'pinned']);

		await db.sortedSetAdd(`cid:${topicData.cid}:tids:lastposttime`, lastposttime, tid);

		await Topics.updateRecent(tid, lastposttime);

		if (!topicData.pinned) {
			await db.sortedSetAdd(`cid:${topicData.cid}:tids`, lastposttime, tid);
		}
	};

	Topics.updateRecent = async function (tid, timestamp) {
		let data = { tid: tid, timestamp: timestamp };
		if (plugins.hooks.hasListeners('filter:topics.updateRecent')) {
			data = await plugins.hooks.fire('filter:topics.updateRecent', { tid: tid, timestamp: timestamp });
		}
		if (data && data.tid && data.timestamp) {
			await db.sortedSetAdd('topics:recent', data.timestamp, data.tid);
		}
	};
};
