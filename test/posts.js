'use strict';
/*global require, before, after*/

var	assert = require('assert');
var async = require('async');

var db = require('./mocks/databasemock');
var topics = require('../src/topics');
var posts = require('../src/posts');
var categories = require('../src/categories');
var user = require('../src/user');

describe('Post\'s', function () {
	var voterUid;
	var voteeUid;
	var postData;
	var topicData;
	var cid;

	before(function (done) {
		async.parallel({
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
		before(function (done) {
			topics.reply({
				uid: voterUid,
				tid: topicData.tid,
				timestamp: Date.now(),
				content: 'A post to delete/restore and purge'
			}, function (err, data) {
				assert.ifError(err);
				pid = data.pid;
				done();
			});
		});

		it('should delete a post', function (done) {
			posts.delete(pid, voterUid, function (err, postData) {
				assert.ifError(err);
				assert(postData);
				posts.getPostField(pid, 'deleted', function (err, isDeleted) {
					assert.ifError(err);
					assert.equal(parseInt(isDeleted, 10), 1);
					done();
				});
			});
		});

		it('should restore a post', function (done) {
			posts.restore(pid, voterUid, function (err, postData) {
				assert.ifError(err);
				assert(postData);
				posts.getPostField(pid, 'deleted', function (err, isDeleted) {
					assert.ifError(err);
					assert.equal(parseInt(isDeleted, 10), 0);
					done();
				});
			});
		});

		it('should purge a post', function (done) {
			posts.purge(pid, voterUid, function (err) {
				assert.ifError(err);
				assert.equal(arguments.length, 1);
				posts.exists('post:' + pid, function (err, exists) {
					assert.ifError(err);
					assert.equal(exists, false);
					done();
				});
			});
		});
	});


	after(function (done) {
		db.flushdb(done);
	});
});
