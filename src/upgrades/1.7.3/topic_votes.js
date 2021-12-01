'use strict';


const batch = require('../../batch');
const db = require('../../database');

module.exports = {
	name: 'Add votes to topics',
	timestamp: Date.UTC(2017, 11, 8),
	method: async function () {
		const { progress } = this;

		batch.processSortedSet('topics:tid', async (tids) => {
			await Promise.all(tids.map(async (tid) => {
				progress.incr();
				const topicData = await db.getObjectFields(`topic:${tid}`, ['mainPid', 'cid', 'pinned']);
				if (topicData.mainPid && topicData.cid) {
					const postData = await db.getObject(`post:${topicData.mainPid}`);
					if (postData) {
						const upvotes = parseInt(postData.upvotes, 10) || 0;
						const downvotes = parseInt(postData.downvotes, 10) || 0;
						const data = {
							upvotes: upvotes,
							downvotes: downvotes,
						};
						const votes = upvotes - downvotes;
						await Promise.all([
							db.setObject(`topic:${tid}`, data),
							db.sortedSetAdd('topics:votes', votes, tid),
						]);
						if (parseInt(topicData.pinned, 10) !== 1) {
							await db.sortedSetAdd(`cid:${topicData.cid}:tids:votes`, votes, tid);
						}
					}
				}
			}));
		}, {
			progress: progress,
			batch: 500,
		});
	},
};
