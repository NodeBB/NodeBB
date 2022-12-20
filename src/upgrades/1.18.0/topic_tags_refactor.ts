'use strict';

import db from '../../database';


import * as batch from '../../batch';



export const obj = {
	name: 'Store tags in topic hash',
	timestamp: Date.UTC(2021, 8, 9),
	method: async function () {
		const { progress } = this;

		async function getTopicsTags(tids) {
			return await db.getSetsMembers(
				tids.map(tid => `topic:${tid}:tags`),
			);
		}

		await batch.processSortedSet('topics:tid', async (tids) => {
			const tags = await getTopicsTags(tids);

			const topicsWithTags = tids.map((tid, i) => {
				const topic = { tid: tid } as any;
				topic.tags = tags[i];
				return topic;
			}).filter(t => t && t.tags.length);

			await db.setObjectBulk(
				topicsWithTags.map(t => [`topic:${t.tid}`, { tags: t.tags.join(',') }]),
			);
			await db.deleteAll(tids.map(tid => `topic:${tid}:tags`));
			progress.incr(tids.length);
		}, {
			batch: 500,
			progress: progress,
		});
	},
};
