'use strict';

module.exports = {
	name: 'Give global local login privileges',
	timestamp: Date.UTC(2018, 8, 28),
	method: function (callback) {
		var meta = require('../../meta');
		var privileges = require('../../privileges');
		var allowLocalLogin = parseInt(meta.config.allowLocalLogin, 10) !== 0;

		if (allowLocalLogin) {
			privileges.global.give(['local:login'], 'registered-users', callback);
		} else {
			callback();
		}
	},
};
