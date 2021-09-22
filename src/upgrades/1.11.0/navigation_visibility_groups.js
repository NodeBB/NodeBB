'use strict';

module.exports = {
	name: 'Navigation item visibility groups',
	timestamp: Date.UTC(2018, 10, 10),
	method: async function () {
		const navigationAdmin = require('../../navigation/admin');

		const data = await navigationAdmin.get();
		data.forEach((navItem) => {
			if (navItem && navItem.properties) {
				navItem.groups = [];
				if (navItem.properties.adminOnly) {
					navItem.groups.push('administrators');
				} else if (navItem.properties.globalMod) {
					navItem.groups.push('Global Moderators');
				}

				if (navItem.properties.loggedIn) {
					navItem.groups.push('registered-users');
				} else if (navItem.properties.guestOnly) {
					navItem.groups.push('guests');
				}
			}
		});
		await navigationAdmin.save(data);
	},
};
