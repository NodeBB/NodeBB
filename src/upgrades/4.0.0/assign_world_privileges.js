'use strict';

// const db = require('../../database');

module.exports = {
	name: 'Assigning default privileges to "World" pseudo-category',
	timestamp: Date.UTC(2024, 1, 22),
	method: async () => {
		const privileges = require('../../privileges');

		// should match privilege assignment logic in src/categories/create.js EXCEPT commented one liner below
		const defaultPrivileges = [
			'groups:find',
			'groups:read',
			'groups:topics:read',
			'groups:topics:create',
			'groups:topics:reply',
			'groups:topics:tag',
			'groups:posts:edit',
			'groups:posts:history',
			'groups:posts:delete',
			'groups:posts:upvote',
			'groups:posts:downvote',
			'groups:topics:delete',
		];
		const modPrivileges = defaultPrivileges.concat([
			'groups:topics:schedule',
			'groups:posts:view_deleted',
			'groups:purge',
		]);
		const guestPrivileges = ['groups:find', 'groups:read', 'groups:topics:read'];

		await privileges.categories.give(defaultPrivileges, -1, ['registered-users']);
		await privileges.categories.give(defaultPrivileges.slice(3), -1, ['fediverse']); // different priv set for fediverse
		await privileges.categories.give(modPrivileges, -1, ['administrators', 'Global Moderators']);
		await privileges.categories.give(guestPrivileges, -1, ['guests', 'spiders']);
	},
};
