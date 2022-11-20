'use strict';
import meta from '../../meta';

export default  {
	name: 'Give global local login privileges',
	timestamp: Date.UTC(2018, 8, 28),
	method: function (callback) {
		const privileges = require('../../privileges');
		const allowLocalLogin = parseInt(meta.configs.allowLocalLogin, 10) !== 0;

		if (allowLocalLogin) {
			privileges.global.give(['groups:local:login'], 'registered-users', callback);
		} else {
			callback();
		}
	},
};
