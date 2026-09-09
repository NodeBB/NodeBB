'use strict';

const db = require('../../database');
const batch = require('../../batch');
const utils = require('../../utils');

module.exports = {
	name: 'Move ap tids from topics:tid to topicsRemote:tid',
	timestamp: Date.UTC(2026, 1, 24),
	method: async function () {
		const { progress } = this;
		progress.total = await db.sortedSetCard('topics:tid');
		const removeTopics = [];
		await batch.processSortedSet('topics:tid', async (topicData) => {
			const apTopics = topicData.filter(topic => !utils.isNumber(topic.value));
			removeTopics.push(...apTopics.map(topic => topic.value));
			await db.sortedSetAdd(
				'topicsRemote:tid',
				apTopics.map(t => t.score),
				apTopics.map(t => t.value)
			);
			progress.incr(topicData.length);
		}, {
			batch: 500,
			withScores: true,
		});

		progress.current = 0;
		progress.counter = 0;
		progress.total = removeTopics.length;
		await batch.processArray(removeTopics, async (tids) => {
			await db.sortedSetRemove('topics:tid', tids);
			progress.incr(tids.length);
		}, {
			batch: 500,
		});
		const topicCount = await db.sortedSetCard('topics:tid');
		await db.setObjectField('global', 'topicCount', topicCount);
	},
};
