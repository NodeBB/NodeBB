'use strict';

module.exports = {
	name: 'Give global local login privileges',
	timestamp: Date.UTC(2018, 8, 28),
	method: function (callback) {
		const meta = require('../../meta');
		const privileges = require('../../privileges');
		const allowLocalLogin = parseInt(meta.config.allowLocalLogin, 10) !== 0;

		if (allowLocalLogin) {
			privileges.global.give(['groups:local:login'], 'registered-users', callback);
		} else {
			callback();
		}
	},
};
