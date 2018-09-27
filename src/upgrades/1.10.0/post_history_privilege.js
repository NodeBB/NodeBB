'use strict';


var async = require('async');

var privileges = require('../../privileges');
var db = require('../../database');

module.exports = {
	name: 'Give post history viewing privilege to registered-users on all categories',
	timestamp: Date.UTC(2018, 5, 7),
	method: function (callback) {
		db.getSortedSetRange('categories:cid', 0, -1, function (err, cids) {
			if (err) {
				return callback(err);
			}
			async.eachSeries(cids, function (cid, next) {
				privileges.categories.give(['posts:history'], cid, 'registered-users', next);
			}, callback);
		});
	},
};
