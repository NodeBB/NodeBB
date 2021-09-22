/* eslint-disable no-await-in-loop */

'use strict';

const privileges = require('../../privileges');
const groups = require('../../groups');
const db = require('../../database');

module.exports = {
	name: 'Give mods explicit privileges',
	timestamp: Date.UTC(2019, 4, 28),
	method: async function () {
		const defaultPrivileges = [
			'find',
			'read',
			'topics:read',
			'topics:create',
			'topics:reply',
			'topics:tag',
			'posts:edit',
			'posts:history',
			'posts:delete',
			'posts:upvote',
			'posts:downvote',
			'topics:delete',
		];
		const modPrivileges = defaultPrivileges.concat([
			'posts:view_deleted',
			'purge',
		]);

		const globalModPrivs = [
			'groups:chat',
			'groups:upload:post:image',
			'groups:upload:post:file',
			'groups:signature',
			'groups:ban',
			'groups:search:content',
			'groups:search:users',
			'groups:search:tags',
			'groups:view:users',
			'groups:view:tags',
			'groups:view:groups',
			'groups:local:login',
		];

		const cids = await db.getSortedSetRevRange('categories:cid', 0, -1);
		for (const cid of cids) {
			await givePrivsToModerators(cid, '');
			await givePrivsToModerators(cid, 'groups:');
			await privileges.categories.give(modPrivileges.map(p => `groups:${p}`), cid, ['Global Moderators']);
		}
		await privileges.global.give(globalModPrivs, 'Global Moderators');

		async function givePrivsToModerators(cid, groupPrefix) {
			const privGroups = modPrivileges.map(priv => `cid:${cid}:privileges:${groupPrefix}${priv}`);
			const members = await db.getSortedSetRevRange(`group:cid:${cid}:privileges:${groupPrefix}moderate:members`, 0, -1);
			for (const member of members) {
				await groups.join(privGroups, member);
			}
		}
	},
};
