'use strict';

const async = require('async');
const db = require('../../database');
const batch = require('../../batch');
const topics = require('../../topics');

module.exports = {
	name: 'Create category tags sorted sets',
	timestamp: Date.UTC(2020, 10, 23),
	method: async function () {
		const progress = this.progress;
		const cache = {};
		async function categoryTagCount(cid, tag) {
			if (cache[cid] && cache[cid][tag]) {
				return cache[cid][tag];
			}
			const count = await db.sortedSetIntersectCard(
				['cid:' + cid + ':tids:lastposttime', 'tag:' + tag + ':topics']
			);
			cache[cid] = cache[cid] || {};
			cache[cid][tag] = count;
		}

		await batch.processSortedSet('topics:tid', async function (tids) {
			await async.eachSeries(tids, async function (tid) {
				const [topicData, tags] = await Promise.all([
					topics.getTopicFields(tid, ['cid', 'timestamp']),
					topics.getTopicTags(tid),
				]);

				if (tags.length) {
					const cid = topicData.cid;
					await async.eachSeries(tags, async function (tag) {
						const count = await categoryTagCount(cid, tag);
						if (count > 0) {
							await db.sortedSetAdd('cid:' + cid + ':tags', count, tag);
							await db.sortedSetAdd('cid:' + cid + ':tag:' + tag + ':topics', topicData.timestamp, tid);
						}
					});
				}

				progress.incr();
			});
		}, {
			batch: 500,
			progress: progress,
		});
	},
};
