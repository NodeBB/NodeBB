'use strict';

var async = require('async');

module.exports = {
	name: 'Navigation item visibility groups',
	timestamp: Date.UTC(2018, 10, 10),
	method: function (callback) {
		const navigationAdmin = require('../../navigation/admin');

		async.waterfall([
			function (next) {
				navigationAdmin.get(next);
			},
			function (data, next) {
				data.forEach(function (navItem) {
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
				navigationAdmin.save(data, next);
			},
		], callback);
	},
};
