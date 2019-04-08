'use strict';

var privileges = require('../../privileges');

module.exports = {
	name: 'Group create global privilege',
	timestamp: Date.UTC(2019, 0, 4),
	method: function (callback) {
		var meta = require('../../meta');
		if (parseInt(meta.config.allowGroupCreation, 10) === 1) {
			privileges.global.give(['groups:create'], 'registered-users', callback);
		} else {
			setImmediate(callback);
		}
	},
};
