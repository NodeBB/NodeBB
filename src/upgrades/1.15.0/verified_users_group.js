'use strict';

const db = require('../../database');

const batch = require('../../batch');
const user = require('../../user');
const groups = require('../../groups');
const meta = require('../../meta');
const privileges = require('../../privileges');

module.exports = {
	name: 'Create verified/unverified user groups',
	timestamp: Date.UTC(2020, 9, 13),
	method: async function () {
		const progress = this.progress;
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

		await batch.processSortedSet('users:joindate', async function (uids) {
			progress.incr(uids.length);
			const userData = await user.getUsersFields(uids, ['uid', 'email:confirmed']);

			const verified = userData.filter(u => parseInt(u['email:confirmed'], 10) === 1);
			const unverified = userData.filter(u => parseInt(u['email:confirmed'], 10) !== 1);

			for (const user of verified) {
				// eslint-disable-next-line no-await-in-loop
				await groups.join('verified-users', user.uid);
			}
			for (const user of unverified) {
				// eslint-disable-next-line no-await-in-loop
				await groups.join('unverified-users', user.uid);
			}
		}, {
			batch: 500,
			progress: this.progress,
		});

		await db.delete('users:notvalidated');
		await updatePrivilges();
	},
};

async function updatePrivilges() {
	// if email confirmation is required
	//   give chat, posting privs to "verified-users" group
	//   remove chat, posting privs from "registered-users" group
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
