// REMOVE THIS PRIOR TO 4.0 ALPHA

'use strict';

const db = require('../../database');

module.exports = {
	name: 'Fix topic sorted sets for uncategorized topics',
	timestamp: Date.UTC(2024, 2, 26),
	method: async function () {
		const props = ['views', 'posts', 'votes'];
		const { progress } = this;
		const tids = await db.getSortedSetMembers('cid:-1:tids');
		progress.total = tids.length;

		const remove = [];
		const add = [];
		await Promise.all(props.map(async (prop) => {
			const set = `topics:${prop}`;
			const newSet = `topicsRemote:${prop}`;

			const scores = await db.sortedSetScores(set, tids);
			scores.forEach((score, idx) => {
				if (score !== null) {
					remove.push([set, tids[idx]]);
					add.push([newSet, score, tids[idx]]);
				}
			});
		}));

		await Promise.all([
			db.sortedSetRemoveBulk(remove),
			db.sortedSetAddBulk(add),
		]);
	},
};
