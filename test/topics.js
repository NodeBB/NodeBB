'use strict';

var async = require('async');
var assert = require('assert');
var validator = require('validator');
var nconf = require('nconf');

var db = require('./mocks/databasemock');
var topics = require('../src/topics');
var categories = require('../src/categories');
var User = require('../src/user');
var groups = require('../src/groups');
var socketPosts = require('../src/socket.io/posts');

describe('Topic\'s', function () {
	var topic;
	var categoryObj;
	var adminUid;

	before(function (done) {
		User.create({username: 'admin'}, function (err, uid) {
			if (err) {
				return done(err);
			}

			adminUid = uid;

			categories.create({
				name: 'Test Category',
				description: 'Test category created by testing script'
			}, function (err, category) {
				if (err) {
					return done(err);
				}

				categoryObj = category;

				topic = {
					userId: uid,
					categoryId: categoryObj.cid,
					title: 'Test Topic Title',
					content: 'The content of test topic'
				};
				done();
			});
		});


	});

	describe('.post', function () {

		it('should create a new topic with proper parameters', function (done) {
			topics.post({uid: topic.userId, title: topic.title, content: topic.content, cid: topic.categoryId}, function (err, result) {
				assert.equal(err, null, 'was created with error');
				assert.ok(result);

				done();
			});
		});

		it('should fail to create new topic with invalid user id', function (done) {
			topics.post({uid: null, title: topic.title, content: topic.content, cid: topic.categoryId}, function (err) {
				assert.equal(err.message, '[[error:no-privileges]]');
				done();
			});
		});

		it('should fail to create new topic with empty title', function (done) {
			topics.post({uid: topic.userId, title: '', content: topic.content, cid: topic.categoryId}, function (err) {
				assert.ok(err);
				done();
			});
		});

		it('should fail to create new topic with empty content', function (done) {
			topics.post({uid: topic.userId, title: topic.title, content: '', cid: topic.categoryId}, function (err) {
				assert.ok(err);
				done();
			});
		});

		it('should fail to create new topic with non-existant category id', function (done) {
			topics.post({uid: topic.userId, title: topic.title, content: topic.content, cid: 99}, function (err) {
				assert.equal(err.message, '[[error:no-category]]', 'received no error');
				done();
			});
		});
	});

	describe('.reply', function () {
		var newTopic;
		var newPost;

		before(function (done) {
			topics.post({uid: topic.userId, title: topic.title, content: topic.content, cid: topic.categoryId}, function (err, result) {
				if (err) {
					return done(err);
				}

				newTopic = result.topicData;
				newPost = result.postData;
				done();
			});
		});

		it('should create a new reply with proper parameters', function (done) {
			topics.reply({uid: topic.userId, content: 'test post', tid: newTopic.tid}, function (err, result) {
				assert.equal(err, null, 'was created with error');
				assert.ok(result);

				done();
			});
		});

		it('should handle direct replies', function (done) {
			topics.reply({uid: topic.userId, content: 'test reply', tid: newTopic.tid, toPid: newPost.pid}, function (err, result) {
				assert.equal(err, null, 'was created with error');
				assert.ok(result);

				socketPosts.getReplies({uid: 0}, newPost.pid, function (err, postData) {
					assert.equal(err, null, 'posts.getReplies returned error');

					assert.ok(postData);

					assert.equal(postData.length, 1, 'should have 1 result');
					assert.equal(postData[0].pid, result.pid, 'result should be the reply we added');

					done();
				});
			});
		});

		it('should fail to create new reply with invalid user id', function (done) {
			topics.reply({uid: null, content: 'test post', tid: newTopic.tid}, function (err) {
				assert.equal(err.message, '[[error:no-privileges]]');
				done();
			});
		});

		it('should fail to create new reply with empty content', function (done) {
			topics.reply({uid: topic.userId, content: '', tid: newTopic.tid}, function (err) {
				assert.ok(err);
				done();
			});
		});

		it('should fail to create new reply with invalid topic id', function (done) {
			topics.reply({uid: null, content: 'test post', tid: 99}, function (err) {
				assert.equal(err.message, '[[error:no-topic]]');
				done();
			});
		});
	});

	describe('Get methods', function () {
		var	newTopic;
		var newPost;

		before(function (done) {
			topics.post({uid: topic.userId, title: topic.title, content: topic.content, cid: topic.categoryId}, function (err, result) {
				if (err) {
					return done(err);
				}

				newTopic = result.topicData;
				newPost = result.postData;
				done();
			});
		});

		describe('.getTopicData', function () {
			it('should not receive errors', function (done) {
				topics.getTopicData(newTopic.tid, done);
			});
		});

		describe('.getTopicWithPosts', function () {
			it('should get a topic with posts and other data', function (done) {
				topics.getTopicData(newTopic.tid, function (err, topicData) {
					if (err) {
						return done(err);
					}
					topics.getTopicWithPosts(topicData, 'tid:' + newTopic.tid + ':posts', topic.userId, 0, -1, false, function (err, data) {
						if (err) {
							return done(err);
						}
						assert(data);
						assert.equal(data.category.cid, topic.categoryId);
						assert.equal(data.unreplied, true);
						assert.equal(data.deleted, false);
						assert.equal(data.locked, false);
						assert.equal(data.pinned, false);
						done();
					});
				});
			});
		});
	});

	describe('Title escaping', function () {

		it('should properly escape topic title', function (done) {
			var title = '"<script>alert(\'ok1\');</script> new topic test';
			var titleEscaped = validator.escape(title);
			topics.post({uid: topic.userId, title: title, content: topic.content, cid: topic.categoryId}, function (err, result) {
				assert.ifError(err);
				topics.getTopicData(result.topicData.tid, function (err, topicData) {
					assert.ifError(err);
					assert.strictEqual(topicData.titleRaw, title);
					assert.strictEqual(topicData.title, titleEscaped);
					done();
				});
			});
		});
	});

	describe('tools/delete/restore/purge', function () {
		var newTopic;
		var followerUid;
		var moveCid;
		var socketTopics = require('../src/socket.io/topics');
		before(function (done) {
			async.waterfall([
				function (next) {
					groups.join('administrators', adminUid, next);
				},
				function (next) {
					topics.post({uid: topic.userId, title: topic.title, content: topic.content, cid: topic.categoryId}, function (err, result) {
						assert.ifError(err);
						newTopic = result.topicData;
						next();
					});
				},
				function (next) {
					User.create({username: 'topicFollower', password: '123456'}, next);
				},
				function (_uid, next) {
					followerUid = _uid;
					topics.follow(newTopic.tid, _uid, next);
				},
				function (next) {
					categories.create({
						name: 'Test Category',
						description: 'Test category created by testing script'
					}, function (err, category) {
						if (err) {
							return next(err);
						}
						moveCid = category.cid;
						next();
					});
				}
			], done);
		});

		it('should load topic tools', function (done) {
			socketTopics.loadTopicTools({uid: 1}, {tid: newTopic.tid}, function (err, data) {
				assert.ifError(err);
				assert(data);
				done();
			});
		});

		it('should delete the topic', function (done) {
			socketTopics.delete({uid: 1}, {tids: [newTopic.tid], cid: categoryObj.cid}, function (err) {
				assert.ifError(err);
				done();
			});
		});

		it('should restore the topic', function (done) {
			socketTopics.restore({uid: 1}, {tids: [newTopic.tid], cid: categoryObj.cid}, function (err) {
				assert.ifError(err);
				done();
			});
		});

		it('should lock topic', function (done) {
			socketTopics.lock({uid: 1}, {tids: [newTopic.tid], cid: categoryObj.cid}, function (err) {
				assert.ifError(err);
				topics.isLocked(newTopic.tid, function (err, isLocked) {
					assert.ifError(err);
					assert(isLocked);
					done();
				});
			});
		});

		it('should unlock topic', function (done) {
			socketTopics.unlock({uid: 1}, {tids: [newTopic.tid], cid: categoryObj.cid}, function (err) {
				assert.ifError(err);
				topics.isLocked(newTopic.tid, function (err, isLocked) {
					assert.ifError(err);
					assert(!isLocked);
					done();
				});
			});
		});

		it('should pin topic', function (done) {
			socketTopics.pin({uid: 1}, {tids: [newTopic.tid], cid: categoryObj.cid}, function (err) {
				assert.ifError(err);
				db.getObjectField('topic:' + newTopic.tid, 'pinned', function (err, pinned) {
					assert.ifError(err);
					assert.strictEqual(parseInt(pinned, 10), 1);
					done();
				});
			});
		});

		it('should unpin topic', function (done) {
			socketTopics.unpin({uid: 1}, {tids: [newTopic.tid], cid: categoryObj.cid}, function (err) {
				assert.ifError(err);
				db.getObjectField('topic:' + newTopic.tid, 'pinned', function (err, pinned) {
					assert.ifError(err);
					assert.strictEqual(parseInt(pinned, 10), 0);
					done();
				});
			});
		});

		it('should move all topics', function (done) {
			socketTopics.moveAll({uid: 1}, {cid: moveCid, currentCid: categoryObj.cid}, function (err) {
				assert.ifError(err);
				topics.getTopicField(newTopic.tid, 'cid', function (err, cid) {
					assert.ifError(err);
					assert.equal(cid, moveCid);
					done();
				});
			});
		});

		it('should move a topic', function (done) {
			socketTopics.move({uid: 1}, {cid: categoryObj.cid, tids: [newTopic.tid]}, function (err) {
				assert.ifError(err);
				topics.getTopicField(newTopic.tid, 'cid', function (err, cid) {
					assert.ifError(err);
					assert.equal(cid, categoryObj.cid);
					done();
				});
			});
		});

		it('should purge the topic', function (done) {
			socketTopics.purge({uid: 1}, {tids: [newTopic.tid], cid: categoryObj.cid}, function (err) {
				assert.ifError(err);
				db.isSortedSetMember('uid:' + followerUid + ':followed_tids', newTopic.tid, function (err, isMember) {
					assert.ifError(err);
					assert.strictEqual(false, isMember);
					done();
				});
			});
		});
	});

	describe('.ignore', function () {
		var newTid;
		var uid;
		var newTopic;
		before(function (done) {
			uid = topic.userId;
			async.waterfall([
				function (done) {
					topics.post({uid: topic.userId, title: 'Topic to be ignored', content: 'Just ignore me, please!', cid: topic.categoryId}, function (err, result) {
						if (err) {
							return done(err);
						}

						newTopic = result.topicData;
						newTid = newTopic.tid;
						done();
					});
				},
				function (done) {
					topics.markUnread( newTid, uid, done );
				}
			],done);
		});

		it('should not appear in the unread list', function (done) {
			async.waterfall([
				function (done) {
					topics.ignore( newTid, uid, done );
				},
				function (done) {
					topics.getUnreadTopics(0, uid, 0, -1, '', done );
				},
				function (results, done) {
					var topics = results.topics;
					var tids = topics.map( function (topic) { return topic.tid; } );
					assert.equal(tids.indexOf(newTid), -1, 'The topic appeared in the unread list.');
					done();
				}
			], done);
		});

		it('should not appear as unread in the recent list', function (done) {
			async.waterfall([
				function (done) {
					topics.ignore( newTid, uid, done );
				},
				function (done) {
					topics.getLatestTopics( uid, 0, -1, 'year', done );
				},
				function (results, done) {
					var topics = results.topics;
					var topic;
					var i;
					for(i = 0; i < topics.length; ++i) {
						if (parseInt(topics[i].tid, 10) === parseInt(newTid, 10)) {
							assert.equal(false, topics[i].unread, 'ignored topic was marked as unread in recent list');
							return done();
						}
					}
					assert.ok(topic, 'topic didn\'t appear in the recent list');
					done();
				}
			], done);
		});

		it('should appear as unread again when marked as reading', function (done) {
			async.waterfall([
				function (done) {
					topics.ignore( newTid, uid, done );
				},
				function (done) {
					topics.follow( newTid, uid, done );
				},
				function (done) {
					topics.getUnreadTopics(0, uid, 0, -1, '', done );
				},
				function (results, done) {
					var topics = results.topics;
					var tids = topics.map( function (topic) { return topic.tid; } );
					assert.notEqual(tids.indexOf(newTid), -1, 'The topic did not appear in the unread list.');
					done();
				}
			], done);
		});

		it('should appear as unread again when marked as following', function (done) {
			async.waterfall([
				function (done) {
					topics.ignore( newTid, uid, done );
				},
				function (done) {
					topics.follow( newTid, uid, done );
				},
				function (done) {
					topics.getUnreadTopics(0, uid, 0, -1, '', done );
				},
				function (results, done) {
					var topics = results.topics;
					var tids = topics.map( function (topic) { return topic.tid; } );
					assert.notEqual(tids.indexOf(newTid), -1, 'The topic did not appear in the unread list.');
					done();
				}
			], done);
		});
	});



	describe('.fork', function () {
		var newTopic;
		var replies = [];
		var topicPids;
		var originalBookmark = 5;
		function postReply( next ) {
			topics.reply({uid: topic.userId, content: 'test post ' + replies.length, tid: newTopic.tid},
				function (err, result) {
					assert.equal(err, null, 'was created with error');
					assert.ok(result);
					replies.push( result );
					next();
				}
			);
		}

		before( function (done) {
			async.waterfall(
				[
				function (next) {
					groups.join('administrators', topic.userId, next);
				},
				function ( next ) {
					topics.post({uid: topic.userId, title: topic.title, content: topic.content, cid: topic.categoryId}, function (err, result) {
						assert.ifError( err );
						newTopic = result.topicData;
						next();
					});
				},
				function ( next ) { postReply( next );},
				function ( next ) { postReply( next );},
				function ( next ) { postReply( next );},
				function ( next ) { postReply( next );},
				function ( next ) { postReply( next );},
				function ( next ) { postReply( next );},
				function ( next ) { postReply( next );},
				function ( next ) { postReply( next );},
				function ( next ) { postReply( next );},
				function ( next ) { postReply( next );},
				function ( next ) { postReply( next );},
				function ( next ) { postReply( next );},
				function ( next ) {
					topicPids = replies.map( function ( reply ) { return reply.pid; } );
					topics.setUserBookmark( newTopic.tid, topic.userId, originalBookmark, next );
				}],
				done );
		});

		it('should have 12 replies', function (done) {
			assert.equal( 12, replies.length );
			done();
		});

		it('should not update the user\'s bookmark', function (done) {
			async.waterfall([
				function (next) {
					topics.createTopicFromPosts(
						topic.userId,
						'Fork test, no bookmark update',
						topicPids.slice( -2 ),
						newTopic.tid,
						next );
				},
				function ( forkedTopicData, next) {
					topics.getUserBookmark( newTopic.tid, topic.userId, next );
				},
				function ( bookmark, next ) {
					assert.equal( originalBookmark, bookmark );
					next();
				}
			],done);
		});

		it('should update the user\'s bookmark ', function (done) {
			async.waterfall([
				function (next) {
					topics.createTopicFromPosts(
						topic.userId,
						'Fork test, no bookmark update',
						topicPids.slice( 1, 3 ),
						newTopic.tid,
						next );
				},
				function ( forkedTopicData, next) {
					topics.getUserBookmark( newTopic.tid, topic.userId, next );
				},
				function ( bookmark, next ) {
					assert.equal( originalBookmark - 2, bookmark );
					next();
				}
			],done);
		});
	});

	it('should load topic', function (done) {
		topics.post({
			uid: topic.userId,
			title: 'topic for controller test',
			content: 'topic content',
			cid: topic.categoryId,
			thumb: 'http://i.imgur.com/64iBdBD.jpg'
		}, function (err, result) {
			assert.ifError(err);
			assert.ok(result);
			var request = require('request');
			request(nconf.get('url') + '/topic/' + result.topicData.slug, function (err, response, body) {
				assert.ifError(err);
				assert.equal(response.statusCode, 200);
				assert(body);
				done();
			});
		});
	});

	after(function (done) {
		db.emptydb(done);
	});
});
