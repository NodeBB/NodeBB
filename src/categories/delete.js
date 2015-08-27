'use strict';

var async = require('async'),
	db = require('../database'),
	batch = require('../batch'),
	plugins = require('../plugins'),
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
			async.series([
				async.apply(purgeCategory, cid),
				async.apply(plugins.fireHook, 'action:category.delete', cid)
			], callback);
		});
	};

	function purgeCategory(cid, callback) {
		async.parallel([
			function(next) {
				db.sortedSetRemove('categories:cid', cid, next);
			},
			function(next) {
				removeFromParent(cid, next);
			},
			function(next) {
				db.deleteAll([
					'cid:' + cid + ':tids',
					'cid:' + cid + ':tids:posts',
					'cid:' + cid + ':pids',
					'cid:' + cid + ':read_by_uid',
					'cid:' + cid + ':children',
					'category:' + cid
				], next);
			}
		], callback);
	}

	function removeFromParent(cid, callback) {
		async.waterfall([
			function(next) {
				Categories.getCategoryField(cid, 'parentCid', next);
			},
			function(parentCid, next) {
				parentCid = parseInt(parentCid, 10) || 0;
				db.sortedSetRemove('cid:' + parentCid + ':children', cid, next);
			}
		], callback);

	}
};