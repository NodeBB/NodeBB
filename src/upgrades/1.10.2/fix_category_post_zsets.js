'use strict';

var async = require('async');
var db = require('../../database');

var batch = require('../../batch');

module.exports = {
	name: 'Fix category post zsets',
	timestamp: Date.UTC(2018, 9, 10),
	method: function (callback) {
		const progress = this.progress;

		db.getSortedSetRange('categories:cid', 0, -1, function (err, cids) {
			if (err) {
				return callback(err);
			}
			var keys = cids.map(function (cid) {
				return 'cid:' + cid + ':pids';
			});
			var posts = require('../../posts');
			batch.processSortedSet('posts:pid', function (postData, next) {
				async.eachSeries(postData, function (postData, next) {
					progress.incr();
					var pid = postData.value;
					var timestamp = postData.score;
					var cid;
					async.waterfall([
						function (next) {
							posts.getCidByPid(pid, next);
						},
						function (_cid, next) {
							cid = _cid;
							db.isMemberOfSortedSets(keys, pid, next);
						},
						function (isMembers, next) {
							var memberCids = [];
							isMembers.forEach(function (isMember, index) {
								if (isMember) {
									memberCids.push(cids[index]);
								}
							});
							if (memberCids.length > 1) {
								async.waterfall([
									async.apply(db.sortedSetRemove, memberCids.map(cid => 'cid:' + cid + ':pids'), pid),
									async.apply(db.sortedSetAdd, 'cid:' + cid + ':pids', timestamp, pid),
								], next);
							} else {
								next();
							}
						},
					], next);
				}, next);
			}, {
				progress: progress,
				withScores: true,
			}, callback);
		});
	},
};
