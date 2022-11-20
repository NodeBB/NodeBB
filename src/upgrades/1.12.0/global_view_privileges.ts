'use strict';

const async = require('async');
const privileges = require('../../privileges');
import meta from '../../meta';

export default  {
	name: 'Global view privileges',
	timestamp: Date.UTC(2019, 0, 5),
	method: function (callback) {

		const tasks = [
			async.apply(privileges.global.give, ['groups:view:users', 'groups:view:tags', 'groups:view:groups'], 'registered-users'),
		];

		if (parseInt(meta.configs.privateUserInfo, 10) !== 1) {
			tasks.push(async.apply(privileges.global.give, ['groups:view:users', 'groups:view:groups'], 'guests'));
			tasks.push(async.apply(privileges.global.give, ['groups:view:users', 'groups:view:groups'], 'spiders'));
		}

		if (parseInt(meta.configs.privateTagListing, 10) !== 1) {
			tasks.push(async.apply(privileges.global.give, ['groups:view:tags'], 'guests'));
			tasks.push(async.apply(privileges.global.give, ['groups:view:tags'], 'spiders'));
		}

		async.series(tasks, callback);
	},
};
