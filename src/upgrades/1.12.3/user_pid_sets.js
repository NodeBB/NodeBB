'use strict';

const async = require('async');

const db = require('../../database');
const batch = require('../../batch');
const posts = require('../../posts');
const topics = require('../../topics');

module.exports = {
	name: 'Create zsets for user posts per category',
	timestamp: Date.UTC(2019, 5, 23),
	method: function (callback) {
		const progress = this.progress;

		batch.processSortedSet('posts:pid', function (pids, next) {
			async.eachSeries(pids, function (pid, _next) {
				progress.incr();
				let postData;

				async.waterfall([
					function (next) {
						posts.getPostFields(pid, ['uid', 'tid', 'upvotes', 'downvotes', 'timestamp'], next);
					},
					function (_postData, next) {
						if (!_postData.uid || !_postData.tid) {
							return _next();
						}
						postData = _postData;
						topics.getTopicField(postData.tid, 'cid', next);
					},
					function (cid, next) {
						const keys = [
							'cid:' + cid + ':uid:' + postData.uid + ':pids',
						];
						const scores = [
							postData.timestamp,
						];
						if (postData.votes > 0) {
							keys.push('cid:' + cid + ':uid:' + postData.uid + ':pids:votes');
							scores.push(postData.votes);
						}
						db.sortedSetsAdd(keys, scores, pid, next);
					},
					function (next) {
						db.sortedSetRemove('uid:' + postData.uid + ':posts:votes', pid, next);
					},
				], _next);
			}, next);
		}, {
			progress: progress,
		}, callback);
	},
};
