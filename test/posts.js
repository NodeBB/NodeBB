'use strict';
/*global require, before, after*/

var	assert = require('assert');
var async = require('async');

var db = require('./mocks/databasemock');
var topics = require('../src/topics');
var posts = require('../src/posts');
var categories = require('../src/categories');
var privileges = require('../src/privileges');
var user = require('../src/user');

describe('Post\'s', function () {
	var voterUid;
	var voteeUid;
	var postData;
	var topicData;
	var cid;

	before(function (done) {
		async.series({
			voterUid: function (next) {
				user.create({username: 'upvoter'}, next);
			},
			voteeUid: function (next) {
				user.create({username: 'upvotee'}, next);
			},
			category: function (next) {
				categories.create({
					name: 'Test Category',
					description: 'Test category created by testing script'
				}, next);
			}
		}, function (err, results) {
			if (err) {
				return done(err);
			}

			voterUid = results.voterUid;
			voteeUid = results.voteeUid;
			cid = results.category.cid;

			topics.post({
				uid: results.voteeUid,
				cid: results.category.cid,
				title: 'Test Topic Title',
				content: 'The content of test topic'
			}, function (err, data) {
				if (err) {
					return done(err);
				}
				postData = data.postData;
				topicData = data.topicData;
				done();
			});
		});
	});

	describe('voting', function () {

		it('should upvote a post', function (done) {
			posts.upvote(postData.pid, voterUid, function (err, result) {
				assert.ifError(err);
				assert.equal(result.post.upvotes, 1);
				assert.equal(result.post.downvotes, 0);
				assert.equal(result.post.votes, 1);
				assert.equal(result.user.reputation, 1);
				posts.hasVoted(postData.pid, voterUid, function (err, data) {
					assert.ifError(err);
					assert.equal(data.upvoted, true);
					assert.equal(data.downvoted, false);
					done();
				});
			});
		});

		it('should unvote a post', function (done) {
			posts.unvote(postData.pid, voterUid, function (err, result) {
				assert.ifError(err);
				assert.equal(result.post.upvotes, 0);
				assert.equal(result.post.downvotes, 0);
				assert.equal(result.post.votes, 0);
				assert.equal(result.user.reputation, 0);
				posts.hasVoted(postData.pid, voterUid, function (err, data) {
					assert.ifError(err);
					assert.equal(data.upvoted, false);
					assert.equal(data.downvoted, false);
					done();
				});
			});
		});

		it('should downvote a post', function (done) {
			posts.downvote(postData.pid, voterUid, function (err, result) {
				assert.ifError(err);
				assert.equal(result.post.upvotes, 0);
				assert.equal(result.post.downvotes, 1);
				assert.equal(result.post.votes, -1);
				assert.equal(result.user.reputation, -1);
				posts.hasVoted(postData.pid, voterUid, function (err, data) {
					assert.ifError(err);
					assert.equal(data.upvoted, false);
					assert.equal(data.downvoted, true);
					done();
				});
			});
		});
	});

	describe('bookmarking', function () {
		it('should bookmark a post', function (done) {
			posts.bookmark(postData.pid, voterUid, function (err, data) {
				assert.ifError(err);
				assert.equal(data.isBookmarked, true);
				posts.hasBookmarked(postData.pid, voterUid, function (err, hasBookmarked) {
					assert.ifError(err);
					assert.equal(hasBookmarked, true);
					done();
				});
			});
		});

		it('should unbookmark a post', function (done) {
			posts.unbookmark(postData.pid, voterUid, function (err, data) {
				assert.ifError(err);
				assert.equal(data.isBookmarked, false);
				posts.hasBookmarked([postData.pid], voterUid, function (err, hasBookmarked) {
					assert.ifError(err);
					assert.equal(hasBookmarked[0], false);
					done();
				});
			});
		});
	});

	describe('delete/restore/purge', function () {
		var pid;
		var socketPosts = require('../src/socket.io/posts');
		before(function (done) {
			topics.reply({
				uid: voterUid,
				tid: topicData.tid,
				timestamp: Date.now(),
				content: 'A post to delete/restore and purge'
			}, function (err, data) {
				assert.ifError(err);
				pid = data.pid;
				privileges.categories.give(['purge'], cid, 'registered-users', done);
			});
		});

		it('should delete a post', function (done) {
			socketPosts.delete({uid: voterUid}, {pid: pid, tid: topicData.tid}, function (err) {
				assert.ifError(err);
				posts.getPostField(pid, 'deleted', function (err, isDeleted) {
					assert.ifError(err);
					assert.equal(parseInt(isDeleted, 10), 1);
					done();
				});
			});
		});

		it('should restore a post', function (done) {
			socketPosts.restore({uid: voterUid}, {pid: pid, tid: topicData.tid}, function (err) {
				assert.ifError(err);
				posts.getPostField(pid, 'deleted', function (err, isDeleted) {
					assert.ifError(err);
					assert.equal(parseInt(isDeleted, 10), 0);
					done();
				});
			});
		});

		it('should purge a post', function (done) {
			socketPosts.purge({uid: voterUid}, {pid: pid}, function (err) {
				assert.ifError(err);
				posts.exists('post:' + pid, function (err, exists) {
					assert.ifError(err);
					assert.equal(exists, false);
					done();
				});
			});
		});
	});

	describe('flagging a post', function () {
		it('should flag a post', function (done) {
			flagPost(function (err) {
				assert.ifError(err);
				done();
			});
		});

		it('should return nothing without a uid or a reason', function (done) {
			posts.flag(postData, null, "reason", function () {
				assert.equal(arguments.length, 0);
				posts.flag(postData, voteeUid, null, function () {
					assert.equal(arguments.length, 0);
					done();
				});
			});
		});

		it('should return an error without an existing post', function (done) {
			posts.flag({}, voteeUid, "reason", function (err) {
				assert.ifError(!err);
				done();
			});
		});

		it('should return an error if the flag already exists', function (done) {
			posts.flag(postData, voteeUid, "reason", function (err) {
				assert.ifError(!err);
				done();
			});
		});
	});

	function flagPost(next) {
		posts.flag(postData, voteeUid, "reason", next);
	}

	describe('get flag data', function () {
		it('should see the flagged post', function (done) {
			posts.isFlaggedByUser(postData.pid, voteeUid, function (err, hasFlagged) {
				assert.ifError(err);
				assert(hasFlagged);
				done();
			});
		});

		it('should return the flagged post data', function (done) {
			posts.getFlags('posts:flagged', cid, voteeUid, 0, -1, function (err, flagData) {
				assert.ifError(err);
				assert(flagData.posts);
				assert(flagData.count);
				assert.equal(flagData.count, 1);
				assert.equal(flagData.posts.length, 1);
				assert(flagData.posts[0].flagReasons);
				assert.equal(flagData.posts[0].flagReasons.length, 1);
				assert.strictEqual(flagData.posts[0].flagReasons[0].reason, 'reason');
				assert(flagData.posts[0].flagData);
				assert.strictEqual(flagData.posts[0].flagData.state, 'open');
				done();
			});
		});
	});

	describe('updating a flag', function () {
		it('should update a flag', function (done) {
			async.waterfall([
				function (next) {
					posts.updateFlagData(voteeUid, postData.pid, {
						assignee: `${voteeUid}`,
						notes: 'notes'
					}, function (err) {
						assert.ifError(err);
						posts.getFlags('posts:flagged', cid, voteeUid, 0, -1, function (err, flagData) {
							assert.ifError(err);
							assert(flagData.posts);
							assert.equal(flagData.posts.length, 1);
							assert.deepEqual({
								assignee: flagData.posts[0].flagData.assignee,
								notes: flagData.posts[0].flagData.notes,
								state: flagData.posts[0].flagData.state,
								labelClass: flagData.posts[0].flagData.labelClass
							}, {
								assignee: `${voteeUid}`,
								notes: 'notes',
								state: 'open',
								labelClass: 'info'
							});
							next();
						});
					});
				}, function (next) {
					posts.updateFlagData(voteeUid, postData.pid, {
						state: 'rejected'
					}, function (err) {
						assert.ifError(err);
						posts.getFlags('posts:flagged', cid, voteeUid, 0, -1, function (err, flagData) {
							assert.ifError(err);
							assert(flagData.posts);
							assert.equal(flagData.posts.length, 1);
							assert.deepEqual({
								state: flagData.posts[0].flagData.state,
								labelClass: flagData.posts[0].flagData.labelClass
							}, {
								state: 'rejected',
								labelClass: 'danger'
							});
							next();
						});
					});
				}, function (next) {
					posts.updateFlagData(voteeUid, postData.pid, {
						state: 'wip'
					}, function (err) {
						assert.ifError(err);
						posts.getFlags('posts:flagged', cid, voteeUid, 0, -1, function (err, flagData) {
							assert.ifError(err);
							assert(flagData.posts);
							assert.equal(flagData.posts.length, 1);
							assert.deepEqual({
								state: flagData.posts[0].flagData.state,
								labelClass: flagData.posts[0].flagData.labelClass
							}, {
								state: 'wip',
								labelClass: 'warning'
							});
							next();
						});
					});
				}, function (next) {
					posts.updateFlagData(voteeUid, postData.pid, {
						state: 'resolved'
					}, function (err) {
						assert.ifError(err);
						posts.getFlags('posts:flagged', cid, voteeUid, 0, -1, function (err, flagData) {
							assert.ifError(err);
							assert(flagData.posts);
							assert.equal(flagData.posts.length, 1);
							assert.deepEqual({
								state: flagData.posts[0].flagData.state,
								labelClass: flagData.posts[0].flagData.labelClass
							}, {
								state: 'resolved',
								labelClass: 'success'
							});
							next();
						});
					});
				}
			], done);
		});
	});

	describe('dismissing a flag', function () {
		it('should dismiss a flag', function (done) {
			posts.dismissFlag(postData.pid, function (err) {
				assert.ifError(err);
				posts.isFlaggedByUser(postData.pid, voteeUid, function (err, hasFlagged) {
					assert.ifError(err);
					assert(!hasFlagged);
					flagPost(function (err) {
						assert.ifError(err);
						done();
					});
				});
			});
		});

		it('should dismiss all of a user\'s flags', function (done) {
			posts.dismissUserFlags(voteeUid, function (err) {
				assert.ifError(err);
				posts.isFlaggedByUser(postData.pid, voteeUid, function (err, hasFlagged) {
					assert.ifError(err);
					assert(!hasFlagged);
					flagPost(function (err) {
						assert.ifError(err);
						done();
					});
				});
			});
		});

		it('should dismiss all flags', function (done) {
			posts.dismissAllFlags(function (err) {
				assert.ifError(err);
				posts.isFlaggedByUser(postData.pid, voteeUid, function (err, hasFlagged) {
					assert.ifError(err);
					assert(!hasFlagged);
					flagPost(function (err) {
						assert.ifError(err);
						done();
					});
				});
			});
		});
	});

	describe('getPostSummaryByPids', function () {
		it('should return empty array for empty pids', function (done) {
			posts.getPostSummaryByPids([], 0, {}, function (err, data) {
				assert.ifError(err);
				assert.equal(data.length, 0);
				done();
			});
		});

		it('should get post summaries', function (done) {
			posts.getPostSummaryByPids([postData.pid], 0, {}, function (err, data) {
				assert.ifError(err);
				assert(data[0].user);
				assert(data[0].topic);
				assert(data[0].category);
				done();
			});
		});
	});

	after(function (done) {
		db.emptydb(done);
	});
});
