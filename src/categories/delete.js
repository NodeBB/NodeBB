'use strict';

var async = require('async'),
	db = require('../database'),
	batch = require('../batch'),
	plugins = require('../plugins'),
	topics = require('../topics');

module.exports = function(Categories) {

	Categories.purge = function(cid, uid, callback) {
		batch.processSortedSet('cid:' + cid + ':tids', function(tids, next) {
			async.eachLimit(tids, 10, function(tid, next) {
				topics.purgePostsAndTopic(tid, uid, next);
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
		async.series([
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
				async.parallel({
					parentCid: function(next) {
						Categories.getCategoryField(cid, 'parentCid', next);
					},
					children: function(next) {
						db.getSortedSetRange('cid:' + cid + ':children', 0, -1, next);
					}
				}, next);
			},
			function(results, next) {
				async.parallel([
					function(next) {
						results.parentCid = parseInt(results.parentCid, 10) || 0;
						db.sortedSetRemove('cid:' + results.parentCid + ':children', cid, next);
					},
					function(next) {
						async.each(results.children, function(cid, next) {
							async.parallel([
								function(next) {
									db.setObjectField('category:' + cid, 'parentCid', 0, next);
								},
								function(next) {
									db.sortedSetAdd('cid:0:children', cid, cid, next);
								}
							], next);
						}, next);
					}
				], next);
			}
		], function(err, results) {
			callback(err);
		});
	}
};