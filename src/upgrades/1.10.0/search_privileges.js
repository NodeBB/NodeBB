'use strict';

var async = require('async');

module.exports = {
	name: 'Give global search privileges',
	timestamp: Date.UTC(2018, 4, 28),
	method: function (callback) {
		var meta = require('../../meta');
		var privileges = require('../../privileges');
		var allowGuestSearching = parseInt(meta.config.allowGuestSearching, 10) === 1;
		var allowGuestUserSearching = parseInt(meta.config.allowGuestUserSearching, 10) === 1;
		async.waterfall([
			function (next) {
				privileges.global.give(['groups:search:content', 'groups:search:users', 'groups:search:tags'], 'registered-users', next);
			},
			function (next) {
				var guestPrivs = [];
				if (allowGuestSearching) {
					guestPrivs.push('groups:search:content');
				}
				if (allowGuestUserSearching) {
					guestPrivs.push('groups:search:users');
				}
				guestPrivs.push('groups:search:tags');
				privileges.global.give(guestPrivs, 'guests', next);
			},
		], callback);
	},
};
