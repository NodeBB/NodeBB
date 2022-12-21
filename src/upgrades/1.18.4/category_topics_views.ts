'use strict';

const db = require('../../database');
const batch = require('../../batch');
const topics = require('../../topics');

module.exports = {
	name: 'Category topics sorted sets by views',
	timestamp: Date.UTC(2021, 8, 28),
	method: async function () {
		const { progress } = this;

		await batch.processSortedSet('topics:tid', async (tids) => {
			let topicData = await topics.getTopicsData(tids);
			topicData = topicData.filter(t => t && t.cid);
			await db.sortedSetAddBulk(topicData.map(t => ([`cid:${t.cid}:tids:views`, t.viewcount || 0, t.tid])));
			progress.incr(tids.length);
		}, {
			batch: 500,
			progress: progress,
		});
	},
};
