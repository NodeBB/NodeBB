
'use strict';

import db from '../database';
const plugins = require('../plugins');
const posts = require('../posts');

export default  function (Topics) {
	const terms = {
		day: 86400000,
		week: 604800000,
		month: 2592000000,
		year: 31104000000,
	} as any;

	Topics.getRecentTopics = async function (cid: string, uid: string, start: number, stop: number, filter) {
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

	Topics.getLatestTidsFromSet = async function (set, start: number, stop: string | number, term: string) {
		let since = terms.day;
		if (terms[term]) {
			since = terms[term];
		}

		const count = parseInt(stop as string, 10) === -1 ? stop : stop as number - start + 1;
		return await db.getSortedSetRevRangeByScore(set, start, count, '+inf', Date.now() - since);
	};

	Topics.updateLastPostTimeFromLastPid = async function (tid: string) {
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

	Topics.updateLastPostTime = async function (tid: string, lastposttime: number) {
		await Topics.setTopicField(tid, 'lastposttime', lastposttime);
		const topicData = await Topics.getTopicFields(tid, ['cid', 'deleted', 'pinned']);

		await db.sortedSetAdd(`cid:${topicData.cid}:tids:lastposttime`, lastposttime, tid);

		await Topics.updateRecent(tid, lastposttime);

		if (!topicData.pinned) {
			await db.sortedSetAdd(`cid:${topicData.cid}:tids`, lastposttime, tid);
		}
	};

	Topics.updateRecent = async function (tid: string, timestamp: number) {
		let data = { tid: tid, timestamp: timestamp };
		if (plugins.hooks.hasListeners('filter:topics.updateRecent')) {
			data = await plugins.hooks.fire('filter:topics.updateRecent', { tid: tid, timestamp: timestamp });
		}
		if (data && data.tid && data.timestamp) {
			await db.sortedSetAdd('topics:recent', data.timestamp, data.tid);
		}
	};
};
