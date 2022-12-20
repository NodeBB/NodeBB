'use strict';

import async from 'async';
import privileges from '../../privileges';
import meta from '../../meta';




export const obj = {
	name: 'Global view privileges',
	timestamp: Date.UTC(2019, 0, 5),
	method: function (callback) {


		const tasks = [
			async.apply(privileges.global.give, ['groups:view:users', 'groups:view:tags', 'groups:view:groups'], 'registered-users'),
		];

		if (parseInt(meta.config.privateUserInfo, 10) !== 1) {
			tasks.push(async.apply(privileges.global.give, ['groups:view:users', 'groups:view:groups'], 'guests'));
			tasks.push(async.apply(privileges.global.give, ['groups:view:users', 'groups:view:groups'], 'spiders'));
		}

		if (parseInt(meta.config.privateTagListing, 10) !== 1) {
			tasks.push(async.apply(privileges.global.give, ['groups:view:tags'], 'guests'));
			tasks.push(async.apply(privileges.global.give, ['groups:view:tags'], 'spiders'));
		}

		async.series(tasks, callback);
	},
};
