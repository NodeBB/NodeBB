'use strict';

const db = require('../../database');

const batch = require('../../batch');
const user = require('../../user');
const groups = require('../../groups');
const meta = require('../../meta');
const privileges = require('../../privileges');

const now = Date.now();
module.exports = {
	name: 'Create verified/unverified user groups',
	timestamp: Date.UTC(2020, 9, 13),
	method: async function () {
		const { progress } = this;

		const maxGroupLength = meta.config.maximumGroupNameLength;
		meta.config.maximumGroupNameLength = 30;
		const timestamp = await db.getObjectField('group:administrators', 'timestamp');
		const verifiedExists = await groups.exists('verified-users');
		if (!verifiedExists) {
			await groups.create({
				name: 'verified-users',
				hidden: 1,
				private: 1,
				system: 1,
				disableLeave: 1,
				disableJoinRequests: 1,
				timestamp: timestamp + 1,
			});
		}
		const unverifiedExists = await groups.exists('unverified-users');
		if (!unverifiedExists) {
			await groups.create({
				name: 'unverified-users',
				hidden: 1,
				private: 1,
				system: 1,
				disableLeave: 1,
				disableJoinRequests: 1,
				timestamp: timestamp + 1,
			});
		}
		// restore setting
		meta.config.maximumGroupNameLength = maxGroupLength;
		await batch.processSortedSet('users:joindate', async (uids) => {
			progress.incr(uids.length);
			const userData = await user.getUsersFields(uids, ['uid', 'email:confirmed']);

			const verified = userData.filter(u => parseInt(u['email:confirmed'], 10) === 1);
			const unverified = userData.filter(u => parseInt(u['email:confirmed'], 10) !== 1);

			await db.sortedSetAdd(
				'group:verified-users:members',
				verified.map(() => now),
				verified.map(u => u.uid)
			);

			await db.sortedSetAdd(
				'group:unverified-users:members',
				unverified.map(() => now),
				unverified.map(u => u.uid)
			);
		}, {
			batch: 500,
			progress: this.progress,
		});

		await db.delete('users:notvalidated');
		await updatePrivilges();

		const verifiedCount = await db.sortedSetCard('group:verified-users:members');
		const unverifiedCount = await db.sortedSetCard('group:unverified-users:members');
		await db.setObjectField('group:verified-users', 'memberCount', verifiedCount);
		await db.setObjectField('group:unverified-users', 'memberCount', unverifiedCount);
	},
};

async function updatePrivilges() {
	// if email confirmation is required
	//   give chat, posting privs to "verified-users" group
	//   remove chat, posting privs from "registered-users" group

	// This config property has been removed from v1.18.0+, but is still present in old datasets
	if (meta.config.requireEmailConfirmation) {
		const cids = await db.getSortedSetRevRange('categories:cid', 0, -1);
		const canChat = await privileges.global.canGroup('chat', 'registered-users');
		if (canChat) {
			await privileges.global.give(['groups:chat'], 'verified-users');
			await privileges.global.rescind(['groups:chat'], 'registered-users');
		}
		for (const cid of cids) {
			/* eslint-disable no-await-in-loop */
			const data = await privileges.categories.list(cid);

			const registeredUsersPrivs = data.groups.find(d => d.name === 'registered-users').privileges;

			if (registeredUsersPrivs['groups:topics:create']) {
				await privileges.categories.give(['groups:topics:create'], cid, 'verified-users');
				await privileges.categories.rescind(['groups:topics:create'], cid, 'registered-users');
			}

			if (registeredUsersPrivs['groups:topics:reply']) {
				await privileges.categories.give(['groups:topics:reply'], cid, 'verified-users');
				await privileges.categories.rescind(['groups:topics:reply'], cid, 'registered-users');
			}
		}
	}
}
