'use strict';

var async = require('async');
var privileges = require('../../privileges');

module.exports = {
	name: 'Global view privileges',
	timestamp: Date.UTC(2019, 0, 5),
	method: function (callback) {
		var meta = require('../../meta');

		var tasks = [
			async.apply(privileges.global.give, ['view:users', 'view:tags', 'view:groups'], 'registered-users'),
		];

		if (parseInt(meta.config.privateUserInfo, 10) !== 1) {
			tasks.push(async.apply(privileges.global.give, ['view:users', 'view:groups'], 'guests'));
			tasks.push(async.apply(privileges.global.give, ['view:users', 'view:groups'], 'spiders'));
		}

		if (parseInt(meta.config.privateTagListing, 10) !== 1) {
			tasks.push(async.apply(privileges.global.give, ['view:tags'], 'guests'));
			tasks.push(async.apply(privileges.global.give, ['view:tags'], 'spiders'));
		}

		async.series(tasks, callback);
	},
};
