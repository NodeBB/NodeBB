'use strict';


var	assert = require('assert');
var async = require('async');
var request = require('request');
var nconf = require('nconf');
var crypto = require('crypto');
var fs = require('fs');
var path = require('path');

var db = require('./mocks/databasemock');
var topics = require('../src/topics');
var posts = require('../src/posts');
var categories = require('../src/categories');
var privileges = require('../src/privileges');
var user = require('../src/user');
var groups = require('../src/groups');
var socketPosts = require('../src/socket.io/posts');
var socketTopics = require('../src/socket.io/topics');
var meta = require('../src/meta');
var helpers = require('./helpers');

describe('Post\'s', function () {
	var voterUid;
	var voteeUid;
	var globalModUid;
	var postData;
	var topicData;
	var cid;

	before(function (done) {
		async.series({
			voterUid: function (next) {
				user.create({ username: 'upvoter' }, next);
			},
			voteeUid: function (next) {
				user.create({ username: 'upvotee' }, next);
			},
			globalModUid: function (next) {
				user.create({ username: 'globalmod', password: 'globalmodpwd' }, next);
			},
			category: function (next) {
				categories.create({
					name: 'Test Category',
					description: 'Test category created by testing script',
				}, next);
			},
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
				content: 'The content of test topic',
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

	it('should update category teaser properly', async function () {
		const util = require('util');
		const getCategoriesAsync = util.promisify(async function getCategories(callback) {
			request(nconf.get('url') + '/api/categories', { json: true }, function (err, res, body) {
				callback(err, body);
			});
		});

		const postResult = await topics.post({ uid: globalModUid, cid: cid, title: 'topic title', content: '123456789' });

		let data = await getCategoriesAsync();
		assert.equal(data.categories[0].teaser.pid, postResult.postData.pid);
		assert.equal(data.categories[0].posts[0].content, '123456789');
		assert.equal(data.categories[0].posts[0].pid, postResult.postData.pid);

		const newUid = await user.create({ username: 'teaserdelete' });
		const newPostResult = await topics.post({ uid: newUid, cid: cid, title: 'topic title', content: 'xxxxxxxx' });

		data = await getCategoriesAsync();
		assert.equal(data.categories[0].teaser.pid, newPostResult.postData.pid);
		assert.equal(data.categories[0].posts[0].content, 'xxxxxxxx');
		assert.equal(data.categories[0].posts[0].pid, newPostResult.postData.pid);

		await user.delete(1, newUid);

		data = await getCategoriesAsync();
		assert.equal(data.categories[0].teaser.pid, postResult.postData.pid);
		assert.equal(data.categories[0].posts[0].content, '123456789');
		assert.equal(data.categories[0].posts[0].pid, postResult.postData.pid);
	});

	it('should change owner of post and topic properly', async function () {
		const oldUid = await user.create({ username: 'olduser' });
		const newUid = await user.create({ username: 'newuser' });
		const postResult = await topics.post({ uid: oldUid, cid: cid, title: 'change owner', content: 'original post' });
		const postData = await topics.reply({ uid: oldUid, tid: postResult.topicData.tid, content: 'firstReply' });
		const pid1 = postResult.postData.pid;
		const pid2 = postData.pid;

		assert.deepStrictEqual(await db.sortedSetScores('tid:' + postResult.topicData.tid + ':posters', [oldUid, newUid]), [2, null]);

		await posts.changeOwner([pid1, pid2], newUid);

		assert.deepStrictEqual(await db.sortedSetScores('tid:' + postResult.topicData.tid + ':posters', [oldUid, newUid]), [0, 2]);

		assert.deepStrictEqual(await posts.isOwner([pid1, pid2], oldUid), [false, false]);
		assert.deepStrictEqual(await posts.isOwner([pid1, pid2], newUid), [true, true]);

		assert.strictEqual(await user.getUserField(oldUid, 'postcount'), 0);
		assert.strictEqual(await user.getUserField(newUid, 'postcount'), 2);

		assert.strictEqual(await user.getUserField(oldUid, 'topiccount'), 0);
		assert.strictEqual(await user.getUserField(newUid, 'topiccount'), 1);

		assert.strictEqual(await db.sortedSetScore('users:postcount', oldUid), 0);
		assert.strictEqual(await db.sortedSetScore('users:postcount', newUid), 2);

		assert.strictEqual(await topics.isOwner(postResult.topicData.tid, oldUid), false);
		assert.strictEqual(await topics.isOwner(postResult.topicData.tid, newUid), true);
	});

	it('should fail to change owner if new owner does not exist', async function () {
		try {
			await posts.changeOwner([1], '9999999');
		} catch (err) {
			assert.strictEqual(err.message, '[[error:no-user]]');
		}
	});

	it('should fail to change owner if user is not authorized', async function () {
		try {
			await socketPosts.changeOwner({ uid: voterUid }, { pids: [1, 2], toUid: voterUid });
		} catch (err) {
			assert.strictEqual(err.message, '[[error:no-privileges]]');
		}
	});

	it('should return falsy if post does not exist', function (done) {
		posts.getPostData(9999, function (err, postData) {
			assert.ifError(err);
			assert.equal(postData, null);
			done();
		});
	});

	describe('voting', function () {
		it('should fail to upvote post if group does not have upvote permission', function (done) {
			privileges.categories.rescind(['groups:posts:upvote', 'groups:posts:downvote'], cid, 'registered-users', function (err) {
				assert.ifError(err);
				socketPosts.upvote({ uid: voterUid }, { pid: postData.pid, room_id: 'topic_1' }, function (err) {
					assert.equal(err.message, '[[error:no-privileges]]');
					socketPosts.downvote({ uid: voterUid }, { pid: postData.pid, room_id: 'topic_1' }, function (err) {
						assert.equal(err.message, '[[error:no-privileges]]');
						privileges.categories.give(['groups:posts:upvote', 'groups:posts:downvote'], cid, 'registered-users', function (err) {
							assert.ifError(err);
							done();
						});
					});
				});
			});
		});

		it('should upvote a post', function (done) {
			socketPosts.upvote({ uid: voterUid }, { pid: postData.pid, room_id: 'topic_1' }, function (err, result) {
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
			socketPosts.getVoters({ uid: globalModUid }, { pid: postData.pid, cid: cid }, function (err, data) {
				assert.ifError(err);
				assert.equal(data.upvoteCount, 1);
				assert.equal(data.downvoteCount, 0);
				assert(Array.isArray(data.upvoters));
				assert.equal(data.upvoters[0].username, 'upvoter');
				done();
			});
		});

		it('should get upvoters', function (done) {
			socketPosts.getUpvoters({ uid: globalModUid }, [postData.pid], function (err, data) {
				assert.ifError(err);
				assert.equal(data[0].otherCount, 0);
				assert.equal(data[0].usernames, 'upvoter');
				done();
			});
		});

		it('should unvote a post', function (done) {
			socketPosts.unvote({ uid: voterUid }, { pid: postData.pid, room_id: 'topic_1' }, function (err, result) {
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
			socketPosts.downvote({ uid: voterUid }, { pid: postData.pid, room_id: 'topic_1' }, function (err, result) {
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

		it('should prevent downvoting more than total daily limit', async () => {
			const oldValue = meta.config.downvotesPerDay;
			meta.config.downvotesPerDay = 1;
			let err;
			const p1 = await topics.reply({
				uid: voteeUid,
				tid: topicData.tid,
				content: 'raw content',
			});
			try {
				await socketPosts.downvote({ uid: voterUid }, { pid: p1.pid, room_id: 'topic_1' });
			} catch (_err) {
				err = _err;
			}
			assert.equal(err.message, '[[error:too-many-downvotes-today, 1]]');
			meta.config.downvotesPerDay = oldValue;
		});

		it('should prevent downvoting target user more than total daily limit', async () => {
			const oldValue = meta.config.downvotesPerUserPerDay;
			meta.config.downvotesPerUserPerDay = 1;
			let err;
			const p1 = await topics.reply({
				uid: voteeUid,
				tid: topicData.tid,
				content: 'raw content',
			});
			try {
				await socketPosts.downvote({ uid: voterUid }, { pid: p1.pid, room_id: 'topic_1' });
			} catch (_err) {
				err = _err;
			}
			assert.equal(err.message, '[[error:too-many-downvotes-today-user, 1]]');
			meta.config.downvotesPerUserPerDay = oldValue;
		});
	});

	describe('bookmarking', function () {
		it('should bookmark a post', function (done) {
			socketPosts.bookmark({ uid: voterUid }, { pid: postData.pid, room_id: 'topic_' + postData.tid }, function (err, data) {
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
			socketPosts.unbookmark({ uid: voterUid }, { pid: postData.pid, room_id: 'topic_' + postData.tid }, function (err, data) {
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

	describe('post tools', function () {
		it('should error if data is invalid', function (done) {
			socketPosts.loadPostTools({ uid: globalModUid }, null, function (err) {
				assert.equal(err.message, '[[error:invalid-data]]');
				done();
			});
		});

		it('should load post tools', function (done) {
			socketPosts.loadPostTools({ uid: globalModUid }, { pid: postData.pid, cid: cid }, function (err, data) {
				assert.ifError(err);
				assert(data.posts.display_edit_tools);
				assert(data.posts.display_delete_tools);
				assert(data.posts.display_moderator_tools);
				assert(data.posts.display_move_tools);
				done();
			});
		});
	});

	describe('delete/restore/purge', function () {
		function createTopicWithReply(callback) {
			topics.post({
				uid: voterUid,
				cid: cid,
				title: 'topic to delete/restore/purge',
				content: 'A post to delete/restore/purge',
			}, function (err, topicPostData) {
				assert.ifError(err);
				topics.reply({
					uid: voterUid,
					tid: topicPostData.topicData.tid,
					timestamp: Date.now(),
					content: 'A post to delete/restore and purge',
				}, function (err, replyData) {
					assert.ifError(err);
					callback(topicPostData, replyData);
				});
			});
		}

		var tid;
		var mainPid;
		var replyPid;

		before(function (done) {
			createTopicWithReply(function (topicPostData, replyData) {
				tid = topicPostData.topicData.tid;
				mainPid = topicPostData.postData.pid;
				replyPid = replyData.pid;
				privileges.categories.give(['groups:purge'], cid, 'registered-users', done);
			});
		});

		it('should error with invalid data', function (done) {
			socketPosts.delete({ uid: voterUid }, null, function (err) {
				assert.equal(err.message, '[[error:invalid-data]]');
				done();
			});
		});

		it('should delete a post', function (done) {
			socketPosts.delete({ uid: voterUid }, { pid: replyPid, tid: tid }, function (err) {
				assert.ifError(err);
				posts.getPostField(replyPid, 'deleted', function (err, isDeleted) {
					assert.ifError(err);
					assert.strictEqual(isDeleted, 1);
					done();
				});
			});
		});

		it('should not see post content if global mod does not have posts:view_deleted privilege', function (done) {
			async.waterfall([
				function (next) {
					user.create({ username: 'global mod', password: '123456' }, next);
				},
				function (uid, next) {
					groups.join('Global Moderators', uid, next);
				},
				function (next) {
					privileges.categories.rescind(['groups:posts:view_deleted'], cid, 'Global Moderators', next);
				},
				function (next) {
					helpers.loginUser('global mod', '123456', function (err, _jar) {
						assert.ifError(err);
						var jar = _jar;

						request(nconf.get('url') + '/api/topic/' + tid, { jar: jar, json: true }, function (err, res, body) {
							assert.ifError(err);
							assert.equal(body.posts[1].content, '[[topic:post_is_deleted]]');
							privileges.categories.give(['groups:posts:view_deleted'], cid, 'Global Moderators', next);
						});
					});
				},
			], done);
		});

		it('should restore a post', function (done) {
			socketPosts.restore({ uid: voterUid }, { pid: replyPid, tid: tid }, function (err) {
				assert.ifError(err);
				posts.getPostField(replyPid, 'deleted', function (err, isDeleted) {
					assert.ifError(err);
					assert.strictEqual(isDeleted, 0);
					done();
				});
			});
		});

		it('should delete posts', function (done) {
			socketPosts.deletePosts({ uid: globalModUid }, { pids: [replyPid, mainPid], tid: tid }, function (err) {
				assert.ifError(err);
				posts.getPostField(replyPid, 'deleted', function (err, deleted) {
					assert.ifError(err);
					assert.strictEqual(deleted, 1);
					posts.getPostField(mainPid, 'deleted', function (err, deleted) {
						assert.ifError(err);
						assert.strictEqual(deleted, 1);
						done();
					});
				});
			});
		});

		it('should delete topic if last main post is deleted', function (done) {
			topics.post({ uid: voterUid, cid: cid, title: 'test topic', content: 'test topic' }, function (err, data) {
				assert.ifError(err);
				socketPosts.deletePosts({ uid: globalModUid }, { pids: [data.postData.pid], tid: data.topicData.tid }, function (err) {
					assert.ifError(err);
					topics.getTopicField(data.topicData.tid, 'deleted', function (err, deleted) {
						assert.ifError(err);
						assert.strictEqual(deleted, 1);
						done();
					});
				});
			});
		});

		it('should purge posts and purge topic', function (done) {
			createTopicWithReply(function (topicPostData, replyData) {
				socketPosts.purgePosts({ uid: voterUid }, { pids: [replyData.pid, topicPostData.postData.pid], tid: topicPostData.topicData.tid }, function (err) {
					assert.ifError(err);
					posts.exists('post:' + replyData.pid, function (err, exists) {
						assert.ifError(err);
						assert.equal(exists, false);
						topics.exists(topicPostData.topicData.tid, function (err, exists) {
							assert.ifError(err);
							assert(!exists);
							done();
						});
					});
				});
			});
		});
	});

	describe('edit', function () {
		var pid;
		var replyPid;
		var tid;
		before(function (done) {
			topics.post({
				uid: voterUid,
				cid: cid,
				title: 'topic to edit',
				content: 'A post to edit',
			}, function (err, data) {
				assert.ifError(err);
				pid = data.postData.pid;
				tid = data.topicData.tid;
				topics.reply({
					uid: voterUid,
					tid: tid,
					timestamp: Date.now(),
					content: 'A reply to edit',
				}, function (err, data) {
					assert.ifError(err);
					replyPid = data.pid;
					privileges.categories.give(['groups:posts:edit'], cid, 'registered-users', done);
				});
			});
		});

		it('should error if user is not logged in', function (done) {
			socketPosts.edit({ uid: 0 }, {}, function (err) {
				assert.equal(err.message, '[[error:not-logged-in]]');
				done();
			});
		});

		it('should error if data is invalid or missing', function (done) {
			socketPosts.edit({ uid: voterUid }, {}, function (err) {
				assert.equal(err.message, '[[error:invalid-data]]');
				done();
			});
		});

		it('should error if title is too short', function (done) {
			socketPosts.edit({ uid: voterUid }, { pid: pid, content: 'edited post content', title: 'a' }, function (err) {
				assert.equal(err.message, '[[error:title-too-short, ' + meta.config.minimumTitleLength + ']]');
				done();
			});
		});

		it('should error if title is too long', function (done) {
			var longTitle = new Array(meta.config.maximumTitleLength + 2).join('a');
			socketPosts.edit({ uid: voterUid }, { pid: pid, content: 'edited post content', title: longTitle }, function (err) {
				assert.equal(err.message, '[[error:title-too-long, ' + meta.config.maximumTitleLength + ']]');
				done();
			});
		});

		it('should error with too few tags', function (done) {
			var oldValue = meta.config.minimumTagsPerTopic;
			meta.config.minimumTagsPerTopic = 1;
			socketPosts.edit({ uid: voterUid }, { pid: pid, content: 'edited post content', tags: [] }, function (err) {
				assert.equal(err.message, '[[error:not-enough-tags, ' + meta.config.minimumTagsPerTopic + ']]');
				meta.config.minimumTagsPerTopic = oldValue;
				done();
			});
		});

		it('should error with too many tags', function (done) {
			var tags = [];
			for (var i = 0; i < meta.config.maximumTagsPerTopic + 1; i += 1) {
				tags.push('tag' + i);
			}
			socketPosts.edit({ uid: voterUid }, { pid: pid, content: 'edited post content', tags: tags }, function (err) {
				assert.equal(err.message, '[[error:too-many-tags, ' + meta.config.maximumTagsPerTopic + ']]');
				done();
			});
		});

		it('should error if content is too short', function (done) {
			socketPosts.edit({ uid: voterUid }, { pid: pid, content: 'e' }, function (err) {
				assert.equal(err.message, '[[error:content-too-short, ' + meta.config.minimumPostLength + ']]');
				done();
			});
		});

		it('should error if content is too long', function (done) {
			var longContent = new Array(meta.config.maximumPostLength + 2).join('a');
			socketPosts.edit({ uid: voterUid }, { pid: pid, content: longContent }, function (err) {
				assert.equal(err.message, '[[error:content-too-long, ' + meta.config.maximumPostLength + ']]');
				done();
			});
		});

		it('should edit post', function (done) {
			socketPosts.edit({ uid: voterUid }, { pid: pid, content: 'edited post content', title: 'edited title', tags: ['edited'] }, function (err, data) {
				assert.ifError(err);
				assert.equal(data.content, 'edited post content');
				assert.equal(data.editor, voterUid);
				assert.equal(data.topic.title, 'edited title');
				assert.equal(data.topic.tags[0].value, 'edited');
				done();
			});
		});

		it('should disallow post editing for new users if post was made past the threshold for editing', function (done) {
			meta.config.newbiePostEditDuration = 1;
			setTimeout(function () {
				socketPosts.edit({ uid: voterUid }, { pid: pid, content: 'edited post content again', title: 'edited title again', tags: ['edited-twice'] }, function (err, data) {
					assert.equal(err.message, '[[error:post-edit-duration-expired, 1]]');
					meta.config.newbiePostEditDuration = 3600;
					done();
				});
			}, 1000);
		});

		it('should edit a deleted post', function (done) {
			socketPosts.delete({ uid: voterUid }, { pid: pid, tid: tid }, function (err) {
				assert.ifError(err);
				socketPosts.edit({ uid: voterUid }, { pid: pid, content: 'edited deleted content', title: 'edited deleted title', tags: ['deleted'] }, function (err, data) {
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
			socketPosts.edit({ uid: voterUid }, { pid: replyPid, content: 'edited reply' }, function (err, data) {
				assert.ifError(err);
				assert.equal(data.content, 'edited reply');
				assert.equal(data.editor, voterUid);
				assert.equal(data.topic.isMainPost, false);
				assert.equal(data.topic.renamed, false);
				done();
			});
		});

		it('should return diffs', function (done) {
			posts.diffs.get(replyPid, 0, function (err, data) {
				assert.ifError(err);
				assert(Array.isArray(data));
				assert(data[0].pid, replyPid);
				assert(data[0].patch);
				done();
			});
		});

		it('should load diffs and reconstruct post', function (done) {
			posts.diffs.load(replyPid, 0, voterUid, function (err, data) {
				assert.ifError(err);
				assert.equal(data.content, 'A reply to edit');
				done();
			});
		});

		it('should not allow guests to view diffs', function (done) {
			socketPosts.getDiffs({ uid: 0 }, { pid: 1 }, function (err) {
				assert.equal(err.message, '[[error:no-privileges]]');
				done();
			});
		});

		it('should allow registered-users group to view diffs', function (done) {
			socketPosts.getDiffs({ uid: 1 }, { pid: 1 }, function (err, data) {
				assert.ifError(err);

				assert.strictEqual('boolean', typeof data.editable);
				assert.strictEqual(false, data.editable);

				assert.equal(true, Array.isArray(data.timestamps));
				assert.strictEqual(1, data.timestamps.length);

				assert.equal(true, Array.isArray(data.revisions));
				assert.strictEqual(data.timestamps.length, data.revisions.length);
				['timestamp', 'username'].every(prop => Object.keys(data.revisions[0]).includes(prop));
				done();
			});
		});
	});

	describe('move', function () {
		var replyPid;
		var tid;
		var moveTid;

		before(function (done) {
			async.waterfall([
				function (next) {
					topics.post({
						uid: voterUid,
						cid: cid,
						title: 'topic 1',
						content: 'some content',
					}, next);
				},
				function (data, next) {
					tid = data.topicData.tid;
					topics.post({
						uid: voterUid,
						cid: cid,
						title: 'topic 2',
						content: 'some content',
					}, next);
				},
				function (data, next) {
					moveTid = data.topicData.tid;
					topics.reply({
						uid: voterUid,
						tid: tid,
						timestamp: Date.now(),
						content: 'A reply to move',
					}, function (err, data) {
						assert.ifError(err);
						replyPid = data.pid;
						next();
					});
				},
			], done);
		});

		it('should error if uid is not logged in', function (done) {
			socketPosts.movePost({ uid: 0 }, {}, function (err) {
				assert.equal(err.message, '[[error:not-logged-in]]');
				done();
			});
		});

		it('should error if data is invalid', function (done) {
			socketPosts.movePost({ uid: globalModUid }, {}, function (err) {
				assert.equal(err.message, '[[error:invalid-data]]');
				done();
			});
		});

		it('should error if user does not have move privilege', function (done) {
			socketPosts.movePost({ uid: voterUid }, { pid: replyPid, tid: moveTid }, function (err) {
				assert.equal(err.message, '[[error:no-privileges]]');
				done();
			});
		});


		it('should move a post', function (done) {
			socketPosts.movePost({ uid: globalModUid }, { pid: replyPid, tid: moveTid }, function (err) {
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

	it('should get recent poster uids', function (done) {
		topics.reply({
			uid: voterUid,
			tid: topicData.tid,
			timestamp: Date.now(),
			content: 'some content',
		}, function (err) {
			assert.ifError(err);
			posts.getRecentPosterUids(0, 1, function (err, uids) {
				assert.ifError(err);
				assert(Array.isArray(uids));
				assert.equal(uids.length, 2);
				assert.equal(uids[0], voterUid);
				done();
			});
		});
	});

	describe('parse', function () {
		it('should not crash and return falsy if post data is falsy', function (done) {
			posts.parsePost(null, function (err, postData) {
				assert.ifError(err);
				assert.strictEqual(postData, null);
				done();
			});
		});

		it('should store post content in cache', function (done) {
			var oldValue = global.env;
			global.env = 'production';
			var postData = {
				pid: 9999,
				content: 'some post content',
			};
			posts.parsePost(postData, function (err) {
				assert.ifError(err);
				posts.parsePost(postData, function (err) {
					assert.ifError(err);
					global.env = oldValue;
					done();
				});
			});
		});

		it('should parse signature and remove links and images', function (done) {
			meta.config['signatures:disableLinks'] = 1;
			meta.config['signatures:disableImages'] = 1;
			var userData = {
				signature: '<img src="boop"/><a href="link">test</a> derp',
			};

			posts.parseSignature(userData, 1, function (err, data) {
				assert.ifError(err);
				assert.equal(data.userData.signature, 'test derp');
				meta.config['signatures:disableLinks'] = 0;
				meta.config['signatures:disableImages'] = 0;
				done();
			});
		});

		it('should turn relative links in post body to absolute urls', function (done) {
			var nconf = require('nconf');
			var content = '<a href="/users">test</a> <a href="youtube.com">youtube</a>';
			var parsedContent = posts.relativeToAbsolute(content, posts.urlRegex);
			assert.equal(parsedContent, '<a href="' + nconf.get('base_url') + '/users">test</a> <a href="//youtube.com">youtube</a>');
			done();
		});

		it('should turn relative links in post body to absolute urls', function (done) {
			var nconf = require('nconf');
			var content = '<a href="/users">test</a> <a href="youtube.com">youtube</a> some test <img src="/path/to/img"/>';
			var parsedContent = posts.relativeToAbsolute(content, posts.urlRegex);
			parsedContent = posts.relativeToAbsolute(parsedContent, posts.imgRegex);
			assert.equal(parsedContent, '<a href="' + nconf.get('base_url') + '/users">test</a> <a href="//youtube.com">youtube</a> some test <img src="' + nconf.get('base_url') + '/path/to/img"/>');
			done();
		});
	});

	describe('socket methods', function () {
		var pid;
		before(function (done) {
			topics.reply({
				uid: voterUid,
				tid: topicData.tid,
				timestamp: Date.now(),
				content: 'raw content',
			}, function (err, postData) {
				assert.ifError(err);
				pid = postData.pid;
				privileges.categories.rescind(['groups:topics:read'], cid, 'guests', done);
			});
		});

		it('should error with invalid data', function (done) {
			socketPosts.reply({ uid: 0 }, null, function (err) {
				assert.equal(err.message, '[[error:invalid-data]]');
				done();
			});
		});

		it('should error with invalid tid', function (done) {
			socketPosts.reply({ uid: 0 }, { tid: 0, content: 'derp' }, function (err) {
				assert.equal(err.message, '[[error:invalid-data]]');
				done();
			});
		});

		it('should fail to get raw post because of privilege', function (done) {
			socketPosts.getRawPost({ uid: 0 }, pid, function (err) {
				assert.equal(err.message, '[[error:no-privileges]]');
				done();
			});
		});

		it('should fail to get raw post because post is deleted', function (done) {
			posts.setPostField(pid, 'deleted', 1, function (err) {
				assert.ifError(err);
				socketPosts.getRawPost({ uid: voterUid }, pid, function (err) {
					assert.equal(err.message, '[[error:no-post]]');
					done();
				});
			});
		});

		it('should get raw post content', function (done) {
			posts.setPostField(pid, 'deleted', 0, function (err) {
				assert.ifError(err);
				socketPosts.getRawPost({ uid: voterUid }, pid, function (err, postContent) {
					assert.ifError(err);
					assert.equal(postContent, 'raw content');
					done();
				});
			});
		});

		it('should get post', function (done) {
			socketPosts.getPost({ uid: voterUid }, pid, function (err, postData) {
				assert.ifError(err);
				assert(postData);
				done();
			});
		});

		it('shold error with invalid data', function (done) {
			socketPosts.loadMoreBookmarks({ uid: voterUid }, { uid: voterUid, after: null }, function (err) {
				assert.equal(err.message, '[[error:invalid-data]]');
				done();
			});
		});

		it('should load more bookmarks', function (done) {
			socketPosts.loadMoreBookmarks({ uid: voterUid }, { uid: voterUid, after: 0 }, function (err, data) {
				assert.ifError(err);
				assert(data);
				done();
			});
		});

		it('should load more user posts', function (done) {
			socketPosts.loadMoreUserPosts({ uid: voterUid }, { uid: voterUid, after: 0 }, function (err, data) {
				assert.ifError(err);
				assert(data);
				done();
			});
		});

		it('should load more best posts', function (done) {
			socketPosts.loadMoreBestPosts({ uid: voterUid }, { uid: voterUid, after: 0 }, function (err, data) {
				assert.ifError(err);
				assert(data);
				done();
			});
		});

		it('should load more up voted posts', function (done) {
			socketPosts.loadMoreUpVotedPosts({ uid: voterUid }, { uid: voterUid, after: 0 }, function (err, data) {
				assert.ifError(err);
				assert(data);
				done();
			});
		});

		it('should load more down voted posts', function (done) {
			socketPosts.loadMoreDownVotedPosts({ uid: voterUid }, { uid: voterUid, after: 0 }, function (err, data) {
				assert.ifError(err);
				assert(data);
				done();
			});
		});

		it('should get post category', function (done) {
			socketPosts.getCategory({ uid: voterUid }, pid, function (err, postCid) {
				assert.ifError(err);
				assert.equal(cid, postCid);
				done();
			});
		});

		it('should error with invalid data', function (done) {
			socketPosts.getPidIndex({ uid: voterUid }, null, function (err) {
				assert.equal(err.message, '[[error:invalid-data]]');
				done();
			});
		});

		it('should get pid index', function (done) {
			socketPosts.getPidIndex({ uid: voterUid }, { pid: pid, tid: topicData.tid, topicPostSort: 'oldest_to_newest' }, function (err, index) {
				assert.ifError(err);
				assert.equal(index, 4);
				done();
			});
		});

		it('should get pid index in reverse', function (done) {
			topics.reply({
				uid: voterUid,
				tid: topicData.tid,
				content: 'raw content',
			}, function (err, postData) {
				assert.ifError(err);

				socketPosts.getPidIndex({ uid: voterUid }, { pid: postData.pid, tid: topicData.tid, topicPostSort: 'newest_to_oldest' }, function (err, index) {
					assert.ifError(err);
					assert.equal(index, 1);
					done();
				});
			});
		});
	});

	describe('filterPidsByCid', function () {
		it('should return pids as is if cid is falsy', function (done) {
			posts.filterPidsByCid([1, 2, 3], null, function (err, pids) {
				assert.ifError(err);
				assert.deepEqual([1, 2, 3], pids);
				done();
			});
		});

		it('should filter pids by single cid', function (done) {
			posts.filterPidsByCid([postData.pid, 100, 101], cid, function (err, pids) {
				assert.ifError(err);
				assert.deepEqual([postData.pid], pids);
				done();
			});
		});

		it('should filter pids by multiple cids', function (done) {
			posts.filterPidsByCid([postData.pid, 100, 101], [cid, 2, 3], function (err, pids) {
				assert.ifError(err);
				assert.deepEqual([postData.pid], pids);
				done();
			});
		});

		it('should filter pids by multiple cids', function (done) {
			posts.filterPidsByCid([postData.pid, 100, 101], [cid], function (err, pids) {
				assert.ifError(err);
				assert.deepEqual([postData.pid], pids);
				done();
			});
		});
	});

	it('should error if user does not exist', function (done) {
		user.isReadyToPost(21123123, 1, function (err) {
			assert.equal(err.message, '[[error:no-user]]');
			done();
		});
	});

	describe('post queue', function () {
		var uid;
		var queueId;
		var jar;
		before(function (done) {
			meta.config.postQueue = 1;
			user.create({ username: 'newuser' }, function (err, _uid) {
				assert.ifError(err);
				uid = _uid;
				done();
			});
		});

		after(function (done) {
			meta.config.postQueue = 0;
			meta.config.groupsExemptFromPostQueue = [];
			done();
		});

		it('should add topic to post queue', function (done) {
			socketTopics.post({ uid: uid }, { title: 'should be queued', content: 'queued topic content', cid: cid }, function (err, result) {
				assert.ifError(err);
				assert.strictEqual(result.queued, true);
				assert.equal(result.message, '[[success:post-queued]]');

				done();
			});
		});

		it('should add reply to post queue', function (done) {
			socketPosts.reply({ uid: uid }, { content: 'this is a queued reply', tid: topicData.tid }, function (err, result) {
				assert.ifError(err);
				assert.strictEqual(result.queued, true);
				assert.equal(result.message, '[[success:post-queued]]');
				queueId = result.id;
				done();
			});
		});

		it('should load queued posts', function (done) {
			helpers.loginUser('globalmod', 'globalmodpwd', function (err, _jar) {
				jar = _jar;
				assert.ifError(err);
				request(nconf.get('url') + '/api/post-queue', { jar: jar, json: true }, function (err, res, body) {
					assert.ifError(err);
					assert.equal(body.posts[0].type, 'topic');
					assert.equal(body.posts[0].data.content, 'queued topic content');
					assert.equal(body.posts[1].type, 'reply');
					assert.equal(body.posts[1].data.content, 'this is a queued reply');
					done();
				});
			});
		});

		it('should error if data is invalid', function (done) {
			socketPosts.editQueuedContent({ uid: globalModUid }, null, function (err) {
				assert.equal(err.message, '[[error:invalid-data]]');
				done();
			});
		});

		it('should edit post in queue', function (done) {
			socketPosts.editQueuedContent({ uid: globalModUid }, { id: queueId, content: 'newContent' }, function (err) {
				assert.ifError(err);
				request(nconf.get('url') + '/api/post-queue', { jar: jar, json: true }, function (err, res, body) {
					assert.ifError(err);
					assert.equal(body.posts[1].type, 'reply');
					assert.equal(body.posts[1].data.content, 'newContent');
					done();
				});
			});
		});

		it('should prevent regular users from approving posts', function (done) {
			socketPosts.accept({ uid: uid }, { id: queueId }, function (err) {
				assert.equal(err.message, '[[error:no-privileges]]');
				done();
			});
		});

		it('should prevent regular users from approving non existing posts', function (done) {
			socketPosts.accept({ uid: uid }, { id: 123123 }, function (err) {
				assert.equal(err.message, '[[error:no-privileges]]');
				done();
			});
		});

		it('should accept queued posts and submit', function (done) {
			var ids;
			async.waterfall([
				function (next) {
					db.getSortedSetRange('post:queue', 0, -1, next);
				},
				function (_ids, next) {
					ids = _ids;
					socketPosts.accept({ uid: globalModUid }, { id: ids[0] }, next);
				},
				function (next) {
					socketPosts.accept({ uid: globalModUid }, { id: ids[1] }, next);
				},
			], done);
		});

		it('should not crash if id does not exist', function (done) {
			socketPosts.reject({ uid: globalModUid }, { id: '123123123' }, function (err) {
				assert.equal(err.message, '[[error:no-privileges]]');
				done();
			});
		});

		it('should bypass post queue if user is in exempt group', function (done) {
			meta.config.groupsExemptFromPostQueue = ['registered-users'];
			socketTopics.post({ uid: uid, emit: () => {} }, { title: 'should not be queued', content: 'topic content', cid: cid }, function (err, result) {
				assert.ifError(err);
				assert.strictEqual(result.title, 'should not be queued');
				done();
			});
		});
	});

	describe('upload methods', function () {
		let pid;
		let purgePid;

		before(async () => {
			// Create stub files for testing
			['abracadabra.png', 'shazam.jpg', 'whoa.gif', 'amazeballs.jpg', 'wut.txt', 'test.bmp']
				.forEach(filename => fs.closeSync(fs.openSync(path.join(nconf.get('upload_path'), 'files', filename), 'w')));

			const topicPostData = await topics.post({
				uid: 1,
				cid: 1,
				title: 'topic with some images',
				content: 'here is an image [alt text](/assets/uploads/files/abracadabra.png) and another [alt text](/assets/uploads/files/shazam.jpg)',
			});
			pid = topicPostData.postData.pid;

			const purgePostData = await topics.post({
				uid: 1,
				cid: 1,
				title: 'topic with some images, to be purged',
				content: 'here is an image [alt text](/assets/uploads/files/whoa.gif) and another [alt text](/assets/uploads/files/amazeballs.jpg)',
			});
			purgePid = purgePostData.postData.pid;
		});

		describe('.sync()', function () {
			it('should properly add new images to the post\'s zset', function (done) {
				posts.uploads.sync(pid, function (err) {
					assert.ifError(err);

					db.sortedSetCard('post:' + pid + ':uploads', function (err, length) {
						assert.ifError(err);
						assert.strictEqual(length, 2);
						done();
					});
				});
			});

			it('should remove an image if it is edited out of the post', function (done) {
				async.series([
					function (next) {
						posts.edit({
							pid: pid,
							uid: 1,
							content: 'here is an image [alt text](/assets/uploads/files/abracadabra.png)... AND NO MORE!',
						}, next);
					},
					async.apply(posts.uploads.sync, pid),
				], function (err) {
					assert.ifError(err);
					db.sortedSetCard('post:' + pid + ':uploads', function (err, length) {
						assert.ifError(err);
						assert.strictEqual(1, length);
						done();
					});
				});
			});
		});

		describe('.list()', function () {
			it('should display the uploaded files for a specific post', function (done) {
				posts.uploads.list(pid, function (err, uploads) {
					assert.ifError(err);
					assert.equal(true, Array.isArray(uploads));
					assert.strictEqual(1, uploads.length);
					assert.equal('string', typeof uploads[0]);
					done();
				});
			});
		});

		describe('.isOrphan()', function () {
			it('should return false if upload is not an orphan', function (done) {
				posts.uploads.isOrphan('abracadabra.png', function (err, isOrphan) {
					assert.ifError(err);
					assert.equal(false, isOrphan);
					done();
				});
			});

			it('should return true if upload is an orphan', function (done) {
				posts.uploads.isOrphan('shazam.jpg', function (err, isOrphan) {
					assert.ifError(err);
					assert.equal(true, isOrphan);
					done();
				});
			});
		});

		describe('.associate()', function () {
			it('should add an image to the post\'s maintained list of uploads', function (done) {
				async.waterfall([
					async.apply(posts.uploads.associate, pid, 'whoa.gif'),
					async.apply(posts.uploads.list, pid),
				], function (err, uploads) {
					assert.ifError(err);
					assert.strictEqual(2, uploads.length);
					assert.strictEqual(true, uploads.includes('whoa.gif'));
					done();
				});
			});

			it('should allow arrays to be passed in', function (done) {
				async.waterfall([
					async.apply(posts.uploads.associate, pid, ['amazeballs.jpg', 'wut.txt']),
					async.apply(posts.uploads.list, pid),
				], function (err, uploads) {
					assert.ifError(err);
					assert.strictEqual(4, uploads.length);
					assert.strictEqual(true, uploads.includes('amazeballs.jpg'));
					assert.strictEqual(true, uploads.includes('wut.txt'));
					done();
				});
			});

			it('should save a reverse association of md5sum to pid', function (done) {
				const md5 = filename => crypto.createHash('md5').update(filename).digest('hex');

				async.waterfall([
					async.apply(posts.uploads.associate, pid, ['test.bmp']),
					function (next) {
						db.getSortedSetRange('upload:' + md5('test.bmp') + ':pids', 0, -1, next);
					},
				], function (err, pids) {
					assert.ifError(err);
					assert.strictEqual(true, Array.isArray(pids));
					assert.strictEqual(true, pids.length > 0);
					assert.equal(pid, pids[0]);
					done();
				});
			});

			it('should not associate a file that does not exist on the local disk', function (done) {
				async.waterfall([
					async.apply(posts.uploads.associate, pid, ['nonexistant.xls']),
					async.apply(posts.uploads.list, pid),
				], function (err, uploads) {
					assert.ifError(err);
					assert.strictEqual(uploads.length, 5);
					assert.strictEqual(false, uploads.includes('nonexistant.xls'));
					done();
				});
			});
		});

		describe('.dissociate()', function () {
			it('should remove an image from the post\'s maintained list of uploads', function (done) {
				async.waterfall([
					async.apply(posts.uploads.dissociate, pid, 'whoa.gif'),
					async.apply(posts.uploads.list, pid),
				], function (err, uploads) {
					assert.ifError(err);
					assert.strictEqual(4, uploads.length);
					assert.strictEqual(false, uploads.includes('whoa.gif'));
					done();
				});
			});

			it('should allow arrays to be passed in', function (done) {
				async.waterfall([
					async.apply(posts.uploads.dissociate, pid, ['amazeballs.jpg', 'wut.txt']),
					async.apply(posts.uploads.list, pid),
				], function (err, uploads) {
					assert.ifError(err);
					assert.strictEqual(2, uploads.length);
					assert.strictEqual(false, uploads.includes('amazeballs.jpg'));
					assert.strictEqual(false, uploads.includes('wut.txt'));
					done();
				});
			});
		});

		describe('.dissociateAll()', () => {
			it('should remove all images from a post\'s maintained list of uploads', async () => {
				await posts.uploads.dissociateAll(pid);
				const uploads = await posts.uploads.list(pid);

				assert.equal(uploads.length, 0);
			});
		});

		describe('Dissociation on purge', () => {
			it('should not dissociate images on post deletion', async () => {
				await posts.delete(purgePid, 1);
				const uploads = await posts.uploads.list(purgePid);

				assert.equal(uploads.length, 2);
			});

			it('should dissociate images on post purge', async () => {
				await posts.purge(purgePid, 1);
				const uploads = await posts.uploads.list(purgePid);

				assert.equal(uploads.length, 0);
			});
		});
	});

	describe('post uploads management', function () {
		let topic;
		let reply;
		before(function (done) {
			topics.post({
				uid: 1,
				cid: cid,
				title: 'topic to test uploads with',
				content: '[abcdef](/assets/uploads/files/abracadabra.png)',
			}, function (err, topicPostData) {
				assert.ifError(err);
				topics.reply({
					uid: 1,
					tid: topicPostData.topicData.tid,
					timestamp: Date.now(),
					content: '[abcdef](/assets/uploads/files/shazam.jpg)',
				}, function (err, replyData) {
					assert.ifError(err);
					topic = topicPostData;
					reply = replyData;
					done();
				});
			});
		});

		it('should automatically sync uploads on topic create and reply', function (done) {
			db.sortedSetsCard(['post:' + topic.topicData.mainPid + ':uploads', 'post:' + reply.pid + ':uploads'], function (err, lengths) {
				assert.ifError(err);
				assert.strictEqual(1, lengths[0]);
				assert.strictEqual(1, lengths[1]);
				done();
			});
		});

		it('should automatically sync uploads on post edit', function (done) {
			async.waterfall([
				async.apply(posts.edit, {
					pid: reply.pid,
					uid: 1,
					content: 'no uploads',
				}),
				function (postData, next) {
					posts.uploads.list(reply.pid, next);
				},
			], function (err, uploads) {
				assert.ifError(err);
				assert.strictEqual(true, Array.isArray(uploads));
				assert.strictEqual(0, uploads.length);
				done();
			});
		});
	});
});
