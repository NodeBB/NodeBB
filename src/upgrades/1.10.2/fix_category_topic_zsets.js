'use strict';

const db = require('../../database');

const batch = require('../../batch');

module.exports = {
	name: 'Fix category topic zsets',
	timestamp: Date.UTC(2018, 9, 11),
	method: async function () {
		const { progress } = this;

		const topics = require('../../topics');
		progress.total = await db.sortedSetCard('topics:tid');
		await batch.processSortedSet('topics:tid', async (tids) => {
			progress.incr(tids.length);
			const topicData = await db.getObjectFields(
				tids.map(tid => `topic:${tid}`),
				['tid', 'cid', 'pinned', 'postcount'],
			);
			const bulkAdd = [];
			topicData.forEach((topic) => {
				if (topic && parseInt(topic.pinned, 10) !== 1) {
					topicData.postcount = parseInt(topicData.postcount, 10) || 0;
					bulkAdd.push([`cid:${topicData.cid}:tids:posts`, topicData.postcount, topicData.tid]);
				}
			});
			await db.sortedSetAddBulk(bulkAdd);
			await Promise.all(tids.map(tid => topics.updateLastPostTimeFromLastPid(tid)));
		}, {
			batch: 500,
		});
	},
};
