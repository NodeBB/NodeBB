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
var groups = require('../src/groups');

describe('Post\'s', function () {
	var voterUid;
	var voteeUid;
	var globalModUid;
	var postData;
	var topicData;
	var cid;

	before(function (done) {
		groups.resetCache();
		async.series({
			voterUid: function (next) {
				user.create({username: 'upvoter'}, next);
			},
			voteeUid: function (next) {
				user.create({username: 'upvotee'}, next);
			},
			globalModUid: function (next) {
				user.create({username: 'globalmod'}, next);
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
			globalModUid = results.globalModUid;
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

				groups.join('Global Moderators', globalModUid, done);
			});
		});
	});

	describe('voting', function () {
		var socketPosts = require('../src/socket.io/posts');
		it('should upvote a post', function (done) {
			socketPosts.upvote({uid: voterUid}, {pid: postData.pid, room_id: 'topic_1'}, function (err, result) {
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

		it('should get voters', function (done) {
			socketPosts.getVoters({uid: globalModUid}, {pid: postData.pid, cid: cid}, function (err, data) {
				assert.ifError(err);
				assert.equal(data.upvoteCount, 1);
				assert.equal(data.downvoteCount, 0);
				assert(Array.isArray(data.upvoters));
				assert.equal(data.upvoters[0].username, 'upvoter');
				done();
			});
		});

		it('should get upvoters', function (done) {
			socketPosts.getUpvoters({uid: globalModUid}, [postData.pid], function (err, data) {
				assert.ifError(err);
				assert.equal(data[0].otherCount, 0);
				assert.equal(data[0].usernames, 'upvoter');
				done();
			});
		});

		it('should unvote a post', function (done) {
			socketPosts.unvote({uid: voterUid}, {pid: postData.pid, room_id: 'topic_1'}, function (err, result) {
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
			socketPosts.downvote({uid: voterUid}, {pid: postData.pid, room_id: 'topic_1'}, function (err, result) {
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

	describe('edit', function () {
		var pid;
		var replyPid;
		var tid;
		var socketPosts = require('../src/socket.io/posts');
		var meta = require('../src/meta');
		before(function (done) {
			topics.post({
				uid: voterUid,
				cid: cid,
				title: 'topic to edit',
				content: 'A post to edit'
			}, function (err, data) {
				assert.ifError(err);
				pid = data.postData.pid;
				tid = data.topicData.tid;
				topics.reply({
					uid: voterUid,
					tid: tid,
					timestamp: Date.now(),
					content: 'A reply to edit'
				}, function (err, data) {
					assert.ifError(err);
					replyPid = data.pid;
					privileges.categories.give(['posts:edit'], cid, 'registered-users', done);
				});
			});
		});

		it('should error if user is not logged in', function (done) {
			socketPosts.edit({uid: 0}, {}, function (err) {
				assert.equal(err.message, '[[error:not-logged-in]]');
				done();
			});
		});

		it('should error if data is invalid or missing', function (done) {
			socketPosts.edit({uid: voterUid}, {}, function (err) {
				assert.equal(err.message, '[[error:invalid-data]]');
				done();
			});
		});

		it('should error if title is too short', function (done) {
			socketPosts.edit({uid: voterUid}, {pid: pid, content: 'edited post content', title: 'a'}, function (err) {
				assert.equal(err.message, '[[error:title-too-short, ' + meta.config.minimumTitleLength + ']]');
				done();
			});
		});

		it('should error if title is too long', function (done) {
			var longTitle = new Array(parseInt(meta.config.maximumTitleLength, 10) + 2).join('a');
			socketPosts.edit({uid: voterUid}, {pid: pid, content: 'edited post content', title: longTitle}, function (err) {
				assert.equal(err.message, '[[error:title-too-long, ' + meta.config.maximumTitleLength + ']]');
				done();
			});
		});

		it('should error with too few tags', function (done) {
			var oldValue = meta.config.minimumTagsPerTopic;
			meta.config.minimumTagsPerTopic = 1;
			socketPosts.edit({uid: voterUid}, {pid: pid, content: 'edited post content', tags: []}, function (err) {
				assert.equal(err.message, '[[error:not-enough-tags, ' + meta.config.minimumTagsPerTopic + ']]');
				meta.config.minimumTagsPerTopic = oldValue;
				done();
			});
		});

		it('should error with too many tags', function (done) {
			var tags = [];
			for(var i = 0; i < meta.config.maximumTagsPerTopic + 1; ++i) {
				tags.push('tag' + i);
			}
			socketPosts.edit({uid: voterUid}, {pid: pid, content: 'edited post content', tags: tags}, function (err) {
				assert.equal(err.message, '[[error:too-many-tags, ' + meta.config.maximumTagsPerTopic + ']]');
				done();
			});
		});

		it('should error if content is too short', function (done) {
			socketPosts.edit({uid: voterUid}, {pid: pid, content: 'e'}, function (err) {
				assert.equal(err.message, '[[error:content-too-short, ' + meta.config.minimumPostLength + ']]');
				done();
			});
		});

		it('should error if content is too long', function (done) {
			var longContent = new Array(parseInt(meta.config.maximumPostLength, 10) + 2).join('a');
			socketPosts.edit({uid: voterUid}, {pid: pid, content: longContent}, function (err) {
				assert.equal(err.message, '[[error:content-too-long, ' + meta.config.maximumPostLength + ']]');
				done();
			});
		});

		it('should edit post', function (done) {
			socketPosts.edit({uid: voterUid}, {pid: pid, content: 'edited post content', title: 'edited title', tags: ['edited']}, function (err, data) {
				assert.ifError(err);
				assert.equal(data.content, 'edited post content');
				assert.equal(data.editor, voterUid);
				assert.equal(data.topic.title, 'edited title');
				assert.equal(data.topic.tags[0].value, 'edited');
				done();
			});
		});

		it('should edit a deleted post', function (done) {
			socketPosts.delete({uid: voterUid}, {pid: pid, tid: tid}, function (err) {
				assert.ifError(err);
				socketPosts.edit({uid: voterUid}, {pid: pid, content: 'edited deleted content', title: 'edited deleted title', tags: ['deleted']}, function (err, data) {
					assert.ifError(err);
					assert.equal(data.content, 'edited deleted content');
					assert.equal(data.editor, voterUid);
					assert.equal(data.topic.title, 'edited deleted title');
					assert.equal(data.topic.tags[0].value, 'deleted');
					done();
				});
			});
		});

		it('should edit a reply post', function (done) {
			socketPosts.edit({uid: voterUid}, {pid: replyPid, content: 'edited reply'}, function (err, data) {
				assert.ifError(err);
				assert.equal(data.content, 'edited reply');
				assert.equal(data.editor, voterUid);
				assert.equal(data.topic.isMainPost, false);
				assert.equal(data.topic.renamed, false);
				done();
			});
		});
	});

	describe('move', function () {
		var replyPid;
		var tid;
		var moveTid;
		var socketPosts = require('../src/socket.io/posts');

		before(function (done) {
			async.waterfall([
				function (next) {
					topics.post({
						uid: voterUid,
						cid: cid,
						title: 'topic 1',
						content: 'some content'
					}, next);
				},
				function (data, next) {
					tid = data.topicData.tid;
					topics.post({
						uid: voterUid,
						cid: cid,
						title: 'topic 2',
						content: 'some content'
					}, next);
				},
				function (data, next) {
					moveTid = data.topicData.tid;
					topics.reply({
						uid: voterUid,
						tid: tid,
						timestamp: Date.now(),
						content: 'A reply to move'
					}, function (err, data) {
						assert.ifError(err);
						replyPid = data.pid;
						next();
					});
				}
			], done);
		});

		it('should error if uid is not logged in', function (done) {
			socketPosts.movePost({uid: 0}, {}, function (err) {
				assert.equal(err.message, '[[error:not-logged-in]]');
				done();
			});
		});

		it('should error if data is invalid', function (done) {
			socketPosts.movePost({uid: globalModUid}, {}, function (err) {
				assert.equal(err.message, '[[error:invalid-data]]');
				done();
			});
		});

		it('should error if user does not have move privilege', function (done) {
			socketPosts.movePost({uid: voterUid}, {pid: replyPid, tid: moveTid}, function (err) {
				assert.equal(err.message, '[[error:no-privileges]]');
				done();
			});
		});


		it('should move a post', function (done) {
			socketPosts.movePost({uid: globalModUid}, {pid: replyPid, tid: moveTid}, function (err) {
				assert.ifError(err);
				posts.getPostField(replyPid, 'tid', function (err, tid) {
					assert.ifError(err);
					assert(tid, moveTid);
					done();
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
