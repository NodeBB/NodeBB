'use strict';

var async = require('async'),
	db = require('../database'),
	threadTools = require('../threadTools');


module.exports = function(Categories) {

	Categories.purge = function(cid, callback) {

		Categories.getTopicIds(cid, 0, -1, function(err, tids) {
			if (err) {
				return callback(err);
			}

			async.each(tids, function(tid, next) {
				threadTools.purge(tid, 0, next);
			}, function(err) {
				if (err) {
					return callback(err);
				}

				purgeCategory(cid, callback);
			});
		});
	};

	function purgeCategory(cid, callback) {
		async.parallel([
			function(next) {
				db.sortedSetRemove('categories:cid', cid, next);
			},
			function(next) {
				db.delete('categories:' + cid + ':tid', next);
			},
			function(next) {
				db.delete('categories:recent_posts:cid:' + cid, next);
			},
			function(next) {
				db.delete('category:' + cid, next);
			}
		], callback);
	}
};