'use strict';

var async = require('async');
var db = require('../database');
var batch = require('../batch');
var plugins = require('../plugins');
var topics = require('../topics');
var groups = require('../groups');
var privileges = require('../privileges');
var cache = require('../cache');

module.exports = function (Categories) {
	Categories.purge = function (cid, uid, callback) {
		async.waterfall([
			function (next) {
				batch.processSortedSet('cid:' + cid + ':tids', function (tids, next) {
					async.eachLimit(tids, 10, function (tid, next) {
						topics.purgePostsAndTopic(tid, uid, next);
					}, next);
				}, { alwaysStartAt: 0 }, next);
			},
			function (next) {
				db.getSortedSetRevRange('cid:' + cid + ':tids:pinned', 0, -1, next);
			},
			function (pinnedTids, next) {
				async.eachLimit(pinnedTids, 10, function (tid, next) {
					topics.purgePostsAndTopic(tid, uid, next);
				}, next);
			},
			function (next) {
				purgeCategory(cid, next);
			},
			function (next) {
				plugins.fireHook('action:category.delete', { cid: cid, uid: uid });
				next();
			},
		], callback);
	};

	function purgeCategory(cid, callback) {
		async.series([
			function (next) {
				db.sortedSetRemove('categories:cid', cid, next);
			},
			function (next) {
				removeFromParent(cid, next);
			},
			function (next) {
				db.deleteAll([
					'cid:' + cid + ':tids',
					'cid:' + cid + ':tids:pinned',
					'cid:' + cid + ':tids:posts',
					'cid:' + cid + ':pids',
					'cid:' + cid + ':read_by_uid',
					'cid:' + cid + ':ignorers',
					'cid:' + cid + ':children',
					'cid:' + cid + ':tag:whitelist',
					'category:' + cid,
				], next);
			},
			function (next) {
				groups.destroy(privileges.privilegeList.map(privilege => 'cid:' + cid + ':privileges:' + privilege), next);
			},
		], function (err) {
			callback(err);
		});
	}

	function removeFromParent(cid, callback) {
		async.waterfall([
			function (next) {
				async.parallel({
					parentCid: function (next) {
						Categories.getCategoryField(cid, 'parentCid', next);
					},
					children: function (next) {
						db.getSortedSetRange('cid:' + cid + ':children', 0, -1, next);
					},
				}, next);
			},
			function (results, next) {
				async.parallel([
					function (next) {
						db.sortedSetRemove('cid:' + results.parentCid + ':children', cid, next);
					},
					function (next) {
						async.each(results.children, function (cid, next) {
							async.parallel([
								function (next) {
									db.setObjectField('category:' + cid, 'parentCid', 0, next);
								},
								function (next) {
									db.sortedSetAdd('cid:0:children', cid, cid, next);
								},
							], next);
						}, next);
					},
				], function (err) {
					if (err) {
						return next(err);
					}
					cache.del([
						'categories:cid',
						'cid:0:children',
						'cid:' + results.parentCid + ':children',
						'cid:' + cid + ':children',
						'cid:' + cid + ':tag:whitelist',
					]);
					next();
				});
			},
		], function (err) {
			callback(err);
		});
	}
};
