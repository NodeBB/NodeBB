'use strict';

const batch = require('../../batch');
const db = require('../../database');
const groups = require('../../groups');

const now = Date.now();

module.exports = {
	name: 'Move banned users to banned-users group',
	timestamp: Date.UTC(2020, 11, 13),
	method: async function () {
		const { progress } = this;
		const timestamp = await db.getObjectField('group:administrators', 'timestamp');
		const bannedExists = await groups.exists('banned-users');
		if (!bannedExists) {
			await groups.create({
				name: 'banned-users',
				hidden: 1,
				private: 1,
				system: 1,
				disableLeave: 1,
				disableJoinRequests: 1,
				timestamp: timestamp + 1,
			});
		}

		await batch.processSortedSet('users:banned', async (uids) => {
			progress.incr(uids.length);

			await db.sortedSetAdd(
				'group:banned-users:members',
				uids.map(() => now),
				uids
			);

			await db.sortedSetRemove(
				[
					'group:registered-users:members',
					'group:verified-users:members',
					'group:unverified-users:members',
					'group:Global Moderators:members',
				],
				uids
			);
		}, {
			batch: 500,
			progress: this.progress,
		});


		const bannedCount = await db.sortedSetCard('group:banned-users:members');
		const registeredCount = await db.sortedSetCard('group:registered-users:members');
		const verifiedCount = await db.sortedSetCard('group:verified-users:members');
		const unverifiedCount = await db.sortedSetCard('group:unverified-users:members');
		const globalModCount = await db.sortedSetCard('group:Global Moderators:members');
		await db.setObjectField('group:banned-users', 'memberCount', bannedCount);
		await db.setObjectField('group:registered-users', 'memberCount', registeredCount);
		await db.setObjectField('group:verified-users', 'memberCount', verifiedCount);
		await db.setObjectField('group:unverified-users', 'memberCount', unverifiedCount);
		await db.setObjectField('group:Global Moderators', 'memberCount', globalModCount);
	},
};
