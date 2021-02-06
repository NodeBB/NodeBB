'use strict';

const async = require('async');
const db = require('../../database');

const batch = require('../../batch');

module.exports = {
	name: 'Fix category post zsets',
	timestamp: Date.UTC(2018, 9, 10),
	method: function (callback) {
		const { progress } = this;

		db.getSortedSetRange('categories:cid', 0, -1, (err, cids) => {
			if (err) {
				return callback(err);
			}
			const keys = cids.map(cid => `cid:${cid}:pids`);
			const posts = require('../../posts');
			batch.processSortedSet('posts:pid', (postData, next) => {
				async.eachSeries(postData, (postData, next) => {
					progress.incr();
					const pid = postData.value;
					const timestamp = postData.score;
					let cid;
					async.waterfall([
						function (next) {
							posts.getCidByPid(pid, next);
						},
						function (_cid, next) {
							cid = _cid;
							db.isMemberOfSortedSets(keys, pid, next);
						},
						function (isMembers, next) {
							const memberCids = [];
							isMembers.forEach((isMember, index) => {
								if (isMember) {
									memberCids.push(cids[index]);
								}
							});
							if (memberCids.length > 1) {
								async.waterfall([
									async.apply(db.sortedSetRemove, memberCids.map(cid => `cid:${cid}:pids`), pid),
									async.apply(db.sortedSetAdd, `cid:${cid}:pids`, timestamp, pid),
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
