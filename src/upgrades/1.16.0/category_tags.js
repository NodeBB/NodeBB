'use strict';

const async = require('async');
const db = require('../../database');
const batch = require('../../batch');
const topics = require('../../topics');

module.exports = {
	name: 'Create category tags sorted sets',
	timestamp: Date.UTC(2020, 10, 23),
	method: async function () {
		const { progress } = this;

		async function getTopicsTags(tids) {
			return await db.getSetsMembers(
				tids.map(tid => `topic:${tid}:tags`),
			);
		}

		await batch.processSortedSet('topics:tid', async (tids) => {
			const [topicData, tags] = await Promise.all([
				topics.getTopicsFields(tids, ['tid', 'cid', 'timestamp']),
				getTopicsTags(tids),
			]);
			const topicsWithTags = topicData.map((t, i) => {
				t.tags = tags[i];
				return t;
			}).filter(t => t && t.tags.length);

			await async.eachSeries(topicsWithTags, async (topicObj) => {
				const { cid, tags } = topicObj;
				await db.sortedSetsAdd(
					tags.map(tag => `cid:${cid}:tag:${tag}:topics`),
					topicObj.timestamp,
					topicObj.tid
				);
				const counts = await db.sortedSetsCard(tags.map(tag => `cid:${cid}:tag:${tag}:topics`));
				await db.sortedSetAdd(`cid:${cid}:tags`, counts, tags);
			});
			progress.incr(tids.length);
		}, {
			batch: 500,
			progress: progress,
		});
	},
};
