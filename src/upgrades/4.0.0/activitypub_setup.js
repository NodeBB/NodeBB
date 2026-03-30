'use strict';

const db = require('../../database');
const meta = require('../../meta');
const categories = require('../../categories');
const slugify = require('../../slugify');

module.exports = {
	name: 'Setting up default configs/privileges re: ActivityPub',
	timestamp: Date.UTC(2024, 1, 22),
	method: async () => {
		// Disable ActivityPub (upgraded installs have to opt-in to AP)
		meta.configs.set('activitypubEnabled', 0);

		// Set default privileges for world category
		const install = require('../../install');
		await install.giveWorldPrivileges();

		// Run through all categories and ensure their slugs are unique (incl. users/groups too)
		const cids = await db.getSortedSetMembers('categories:cid');
		const names = await db.getObjectsFields(cids.map(cid => `category:${cid}`), cids.map(() => 'name'));

		const handles = await Promise.all(cids.map(async (cid, idx) => {
			const { name } = names[idx];
			const handle = await categories.generateHandle(slugify(name));
			return handle;
		}));

		await Promise.all([
			db.setObjectBulk(cids.map((cid, idx) => [`category:${cid}`, { handle: handles[idx] }])),
			db.sortedSetAdd('categoryhandle:cid', cids, handles),
		]);
	},
};
