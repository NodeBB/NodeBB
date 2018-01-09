'use strict';


var async = require('async');

var privileges = require('../../privileges');
var db = require('../../database');

module.exports = {
	name: 'Give vote privilege to registered-users on all categories',
	timestamp: Date.UTC(2018, 0, 9),
	method: function (callback) {
		db.getSortedSetRange('categories:cid', 0, -1, function (err, cids) {
			if (err) {
				return callback(err);
			}
			async.eachSeries(cids, function (cid, next) {
				privileges.categories.give(['posts:upvote', 'posts:downvote'], cid, 'registered-users', next);
			}, callback);
		});
	},
};
