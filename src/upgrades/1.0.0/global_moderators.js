'use strict';

module.exports = {
	name: 'Creating Global moderators group',
	timestamp: Date.UTC(2016, 0, 23),
	method: async function () {
		const groups = require('../../groups');
		const exists = await groups.exists('Global Moderators');
		if (exists) {
			return;
		}
		await groups.create({
			name: 'Global Moderators',
			userTitle: 'Global Moderator',
			description: 'Forum wide moderators',
			hidden: 0,
			private: 1,
			disableJoinRequests: 1,
		});
		await groups.show('Global Moderators');
	},
};
