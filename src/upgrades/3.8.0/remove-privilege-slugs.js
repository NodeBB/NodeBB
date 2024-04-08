/* eslint-disable no-await-in-loop */

'use strict';

const db = require('../../database');
const groups = require('../../groups');
const batch = require('../../batch');

module.exports = {
	name: 'Remove privilege groups from groupslug:groupname object',
	timestamp: Date.UTC(2024, 3, 8),
	method: async function () {
		const { progress } = this;

		const slugsToNames = await db.getObject(`groupslug:groupname`);
		const privilegeGroups = [];
		for (const [slug, name] of Object.entries(slugsToNames)) {
			if (groups.isPrivilegeGroup(name)) {
				privilegeGroups.push(slug);
			}
		}

		progress.total = privilegeGroups.length;
		await batch.processArray(privilegeGroups, async (slugs) => {
			progress.incr(slugs.length);
			await db.deleteObjectFields(`groupslug:groupname`, slugs);
		}, {
			batch: 500,
		});
	},
};
