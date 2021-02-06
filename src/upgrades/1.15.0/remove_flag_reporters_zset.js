'use strict';

const db = require('../../database');
const batch = require('../../batch');

module.exports = {
	name: 'Remove flag reporters sorted set',
	timestamp: Date.UTC(2020, 6, 31),
	method: async function () {
		const { progress } = this;
		progress.total = await db.sortedSetCard('flags:datetime');

		await batch.processSortedSet('flags:datetime', async (flagIds) => {
			await Promise.all(flagIds.map(async (flagId) => {
				const [reports, reporterUids] = await Promise.all([
					db.getSortedSetRevRangeWithScores(`flag:${flagId}:reports`, 0, -1),
					db.getSortedSetRevRange(`flag:${flagId}:reporters`, 0, -1),
				]);

				const values = reports.reduce((memo, cur, idx) => {
					memo.push([`flag:${flagId}:reports`, cur.score, [(reporterUids[idx] || 0), cur.value].join(';')]);
					return memo;
				}, []);

				await db.delete(`flag:${flagId}:reports`);
				await db.sortedSetAddBulk(values);
			}));
		}, {
			batch: 500,
			progress: progress,
		});
	},
};
