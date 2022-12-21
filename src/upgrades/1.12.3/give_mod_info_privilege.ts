/* eslint-disable no-await-in-loop */

'use strict';

const db = require('../../database');
const privileges = require('../../privileges');
const groups = require('../../groups');

module.exports = {
	name: 'give mod info privilege',
	timestamp: Date.UTC(2019, 9, 8),
	method: async function () {
		const cids = await db.getSortedSetRevRange('categories:cid', 0, -1);
		for (const cid of cids) {
			await givePrivsToModerators(cid, '');
			await givePrivsToModerators(cid, 'groups:');
		}
		await privileges.global.give(['groups:view:users:info'], 'Global Moderators');

		async function givePrivsToModerators(cid, groupPrefix) {
			const members = await db.getSortedSetRevRange(`group:cid:${cid}:privileges:${groupPrefix}moderate:members`, 0, -1);
			for (const member of members) {
				await groups.join(['cid:0:privileges:view:users:info'], member);
			}
		}
	},
};
