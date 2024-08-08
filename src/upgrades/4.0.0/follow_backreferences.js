'use strict';

const db = require('../../database');
const batch = require('../../batch');
const activitypub = require('../../activitypub');

module.exports = {
	name: 'Establish follow backreference sorted sets for remote users',
	timestamp: Date.UTC(2024, 6, 19),
	method: async function () {
		const { progress } = this;
		const bulkOp = [];
		const now = Date.now();
		const reassert = [];

		await batch.processSortedSet('users:joindate', async (uids) => {
			const [_followers, _following] = await Promise.all([
				db.getSortedSetsMembers(uids.map(uid => `followersRemote:${uid}`)),
				db.getSortedSetsMembers(uids.map(uid => `followingRemote:${uid}`)),
			]);

			const toCheck = Array.from(new Set(_followers.flat().concat(_following.flat())));
			const asserted = await db.isSortedSetMembers('usersRemote:lastCrawled', toCheck);
			reassert.push(...toCheck.filter((actor, idx) => !asserted[idx]));

			uids.forEach((uid, idx) => {
				const followers = _followers[idx];
				if (followers.length) {
					bulkOp.push(...followers.map(actor => [`followingRemote:${actor}`, now, uid]));
				}
			});

			progress.incr(uids.length);
		}, { progress });

		await Promise.all([
			db.sortedSetAddBulk(bulkOp),
			activitypub.actors.assert(Array.from(new Set(reassert))),
		]);
	},
};
