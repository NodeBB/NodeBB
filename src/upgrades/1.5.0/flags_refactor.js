'use strict';

var async = require('async');
var db = require('../../database');


module.exports = {
	name: 'Migrating flags to new schema',
	timestamp: Date.UTC(2016, 11, 7),
	method: function (callback) {
		var batch = require('../../batch');
		var posts = require('../../posts');
		var flags = require('../../flags');
		var progress = this.progress;

		batch.processSortedSet('posts:pid', function (ids, next) {
			posts.getPostsByPids(ids, 1, function (err, posts) {
				if (err) {
					return next(err);
				}

				posts = posts.filter(function (post) {
					return post.hasOwnProperty('flags');
				});

				async.each(posts, function (post, next) {
					progress.incr();

					async.parallel({
						uids: async.apply(db.getSortedSetRangeWithScores, 'pid:' + post.pid + ':flag:uids', 0, -1),
						reasons: async.apply(db.getSortedSetRange, 'pid:' + post.pid + ':flag:uid:reason', 0, -1),
					}, function (err, data) {
						if (err) {
							return next(err);
						}

						// Adding in another check here in case a post was improperly dismissed (flag count > 1 but no flags in db)
						if (!data.uids.length || !data.reasons.length) {
							return setImmediate(next);
						}

						// Just take the first entry
						var datetime = data.uids[0].score;
						var reason = data.reasons[0].split(':')[1];
						var flagObj;

						async.waterfall([
							async.apply(flags.create, 'post', post.pid, data.uids[0].value, reason, datetime),
							function (_flagObj, next) {
								flagObj = _flagObj;
								if (post['flag:state'] || post['flag:assignee']) {
									flags.update(flagObj.flagId, 1, {
										state: post['flag:state'],
										assignee: post['flag:assignee'],
										datetime: datetime,
									}, next);
								} else {
									setImmediate(next);
								}
							},
							function (next) {
								if (post.hasOwnProperty('flag:notes') && post['flag:notes'].length) {
									try {
										var history = JSON.parse(post['flag:history']);
										history = history.filter(function (event) {
											return event.type === 'notes';
										})[0];

										flags.appendNote(flagObj.flagId, history.uid, post['flag:notes'], history.timestamp, next);
									} catch (e) {
										next(e);
									}
								} else {
									setImmediate(next);
								}
							},
						], function (err) {
							if (err && err.message === '[[error:already-flagged]]') {
								// Already flagged, no need to parse, but not an error
								next();
							} else {
								next(err);
							}
						});
					});
				}, next);
			});
		}, {
			progress: this.progress,
		}, callback);
	},
};
