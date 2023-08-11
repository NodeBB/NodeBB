'use strict';

const db = require('../../database');

module.exports = {
	name: 'Migrate post sharing values to config',
	timestamp: Date.UTC(2023, 4, 23),
	method: async () => {
		const activated = await db.getSetMembers('social:posts.activated');
		if (activated.length) {
			const data = {};
			activated.forEach((id) => {
				data[`post-sharing-${id}`] = 1;
			});
			await db.setObject('config', data);
			await db.delete('social:posts.activated');
		}
	},
};
