'use strict';


var async = require('async');

var groups = require('../../groups');
var db = require('../../database');

module.exports = {
	name: 'Give deleted post viewing privilege to moderators on all categories',
	timestamp: Date.UTC(2018, 5, 8),
	method: function (callback) {
		db.getSortedSetRange('categories:cid', 0, -1, function (err, cids) {
			if (err) {
				return callback(err);
			}
			async.eachSeries(cids, function (cid, next) {
				async.waterfall([
					async.apply(db.getSortedSetRange.bind(db), 'group:cid:' + cid + ':privileges:moderate:members', 0, -1),
					function (uids, next) {
						async.eachSeries(uids, (uid, next) => groups.join('cid:' + cid + ':privileges:posts:view_deleted', uid, next), next);
					},
				], next);
			}, callback);
		});
	},
};
