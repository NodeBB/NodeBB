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

		batch.processSortedSet('posts:pid', (pids, next) => {
			progress.incr(pids.length);
			let postData;
			async.waterfall([
				function (next) {
					posts.getPostsFields(pids, ['pid', 'uid', 'tid', 'upvotes', 'downvotes', 'timestamp'], next);
				},
				function (_postData, next) {
					postData = _postData;
					const tids = postData.map(p => p.tid);
					topics.getTopicsFields(tids, ['cid'], next);
				},
				function (topicData, next) {
					const bulk = [];
					postData.forEach((p, index) => {
						if (p && p.uid && p.pid && p.tid && p.timestamp) {
							bulk.push([`cid:${topicData[index].cid}:uid:${p.uid}:pids`, p.timestamp, p.pid]);
							if (p.votes > 0) {
								bulk.push([`cid:${topicData[index].cid}:uid:${p.uid}:pids:votes`, p.votes, p.pid]);
							}
						}
					});
					db.sortedSetAddBulk(bulk, next);
				},
			], next);
		}, {
			progress: progress,
		}, callback);
	},
};
