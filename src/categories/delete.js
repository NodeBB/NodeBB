'use strict';

var async = require('async'),
	db = require('../database'),
	batch = require('../batch'),
	threadTools = require('../threadTools');


module.exports = function(Categories) {

	Categories.purge = function(cid, callback) {
		batch.processSortedSet('cid:' + cid + ':tids', function(tids, next) {
			async.eachLimit(tids, 10, function(tid, next) {
				threadTools.purge(tid, 0, next);
			}, next);
		}, {alwaysStartAt: 0}, function(err) {
			if (err) {
				return callback(err);
			}
			purgeCategory(cid, callback);
		});
	};

	function purgeCategory(cid, callback) {
		async.parallel([
			function(next) {
				db.sortedSetRemove('categories:cid', cid, next);
			},
			function(next) {
				db.deleteAll([
					'cid:' + cid + ':tids',
					'cid:' + cid + ':pids',
					'category:' + cid
				], next);
			}
		], callback);
	}
};