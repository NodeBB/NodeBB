'use strict';


const async = require('async');
const winston = require('winston');
const db = require('../../database');

module.exports = {
	name: 'Store upvotes/downvotes separately',
	timestamp: Date.UTC(2016, 5, 13),
	method: function (callback) {
		const batch = require('../../batch');
		const posts = require('../../posts');
		let count = 0;
		const { progress } = this;

		batch.processSortedSet('posts:pid', (pids, next) => {
			winston.verbose(`upgraded ${count} posts`);
			count += pids.length;
			async.each(pids, (pid, next) => {
				async.parallel({
					upvotes: function (next) {
						db.setCount(`pid:${pid}:upvote`, next);
					},
					downvotes: function (next) {
						db.setCount(`pid:${pid}:downvote`, next);
					},
				}, (err, results) => {
					if (err) {
						return next(err);
					}
					const data = {};

					if (parseInt(results.upvotes, 10) > 0) {
						data.upvotes = results.upvotes;
					}
					if (parseInt(results.downvotes, 10) > 0) {
						data.downvotes = results.downvotes;
					}

					if (Object.keys(data).length) {
						posts.setPostFields(pid, data, next);
					} else {
						next();
					}

					progress.incr();
				}, next);
			}, next);
		}, {
			progress: progress,
		}, callback);
	},
};
