'use strict';
/*global require, before, beforeEach, after*/

var async = require('async');
var	assert = require('assert');
var validator = require('validator');
var nconf = require('nconf');

var db = require('./mocks/databasemock');
var topics = require('../src/topics');
var categories = require('../src/categories');
var User = require('../src/user');
var groups = require('../src/groups');

describe('Topic\'s', function () {
	var topic;
	var categoryObj;

	before(function (done) {
		var userData = {
			username: 'John Smith',
			password: 'swordfish',
			email: 'john@example.com',
			callback: undefined
		};

		User.create({username: userData.username, password: userData.password, email: userData.email}, function (err, uid) {
			if (err) {
				return done(err);
			}

			categories.create({
				name: 'Test Category',
				description: 'Test category created by testing script',
				icon: 'fa-check',
				blockclass: 'category-blue',
				order: '5'
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

	describe('delete/restore/purge', function () {
		var newTopic;
		var followerUid;
		before(function (done) {
			async.waterfall([
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
				}
			], done);
		});

		it('should delete the topic', function (done) {
			topics.delete(newTopic.tid, 1, function (err) {
				assert.ifError(err);
				done();
			});
		});

		it('should restore the topic', function (done) {
			topics.restore(newTopic.tid, 1, function (err) {
				assert.ifError(err);
				done();
			});
		});

		it('should purge the topic', function (done) {
			topics.purge(newTopic.tid, 1, function (err) {
				assert.ifError(err);
				db.isSortedSetMember('uid:' + followerUid + ':followed_tids', newTopic.tid, function (err, isMember) {
					assert.ifError(err);
					assert.strictEqual(false, isMember);
					done();
				});
			});
		});
	});

	describe('.ignore', function (){
		var newTid;
		var uid;
		var newTopic;
		before(function (done){
			uid = topic.userId;
			async.waterfall([
				function (done){
					topics.post({uid: topic.userId, title: 'Topic to be ignored', content: 'Just ignore me, please!', cid: topic.categoryId}, function (err, result) {
						if (err) {
							return done(err);
						}

						newTopic = result.topicData;
						newTid = newTopic.tid;
						done();
					});
				},
				function (done){
					topics.markUnread( newTid, uid, done );
				}
			],done);
		});

		it('should not appear in the unread list', function (done){
			async.waterfall([
				function (done){
					topics.ignore( newTid, uid, done );
				},
				function (done){
					topics.getUnreadTopics(0, uid, 0, -1, '', done );
				},
				function (results, done){
					var topics = results.topics;
					var tids = topics.map( function (topic){ return topic.tid; } );
					assert.equal(tids.indexOf(newTid), -1, 'The topic appeared in the unread list.');
					done();
				}
			], done);
		});

		it('should not appear as unread in the recent list', function (done){
			async.waterfall([
				function (done){
					topics.ignore( newTid, uid, done );
				},
				function (done){
					topics.getLatestTopics( uid, 0, -1, 'year', done );
				},
				function (results, done){
					var topics = results.topics;
					var topic;
					var i;
					for(i = 0; i < topics.length; ++i){
						if( topics[i].tid == newTid ){
							assert.equal(false, topics[i].unread, 'ignored topic was marked as unread in recent list');
							return done();
						}
					}
					assert.ok(topic, 'topic didn\'t appear in the recent list');
					done();
				}
			], done);
		});

		it('should appear as unread again when marked as reading', function (done){
			async.waterfall([
				function (done){
					topics.ignore( newTid, uid, done );
				},
				function (done){
					topics.follow( newTid, uid, done );
				},
				function (done){
					topics.getUnreadTopics(0, uid, 0, -1, '', done );
				},
				function (results, done){
					var topics = results.topics;
					var tids = topics.map( function (topic){ return topic.tid; } );
					assert.notEqual(tids.indexOf(newTid), -1, 'The topic did not appear in the unread list.');
					done();
				}
			], done);
		});

		it('should appear as unread again when marked as following', function (done){
			async.waterfall([
				function (done){
					topics.ignore( newTid, uid, done );
				},
				function (done){
					topics.follow( newTid, uid, done );
				},
				function (done){
					topics.getUnreadTopics(0, uid, 0, -1, '', done );
				},
				function (results, done){
					var topics = results.topics;
					var tids = topics.map( function (topic){ return topic.tid; } );
					assert.notEqual(tids.indexOf(newTid), -1, 'The topic did not appear in the unread list.');
					done();
				}
			], done);
		});
	});



	describe('.fork', function (){
		var newTopic;
		var replies = [];
		var topicPids;
		var originalBookmark = 5;
		function postReply( next ){
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
				function (next){
					groups.join('administrators', topic.userId, next);
				},
				function ( next ){
					topics.post({uid: topic.userId, title: topic.title, content: topic.content, cid: topic.categoryId}, function (err, result) {
						assert.ifError( err );
						newTopic = result.topicData;
						next();
					});
				},
				function ( next ){ postReply( next );},
				function ( next ){ postReply( next );},
				function ( next ){ postReply( next );},
				function ( next ){ postReply( next );},
				function ( next ){ postReply( next );},
				function ( next ){ postReply( next );},
				function ( next ){ postReply( next );},
				function ( next ){ postReply( next );},
				function ( next ){ postReply( next );},
				function ( next ){ postReply( next );},
				function ( next ){ postReply( next );},
				function ( next ){ postReply( next );},
				function ( next ){
					topicPids = replies.map( function ( reply ){ return reply.pid; } );
					topics.setUserBookmark( newTopic.tid, topic.userId, originalBookmark, next );
				}],
				done );
		});

		it('should have 12 replies', function (done) {
			assert.equal( 12, replies.length );
			done();
		});

		it('should not update the user\'s bookmark', function (done){
			async.waterfall([
				function (next){
					topics.createTopicFromPosts(
						topic.userId,
						'Fork test, no bookmark update',
						topicPids.slice( -2 ),
						newTopic.tid,
						next );
				},
				function ( forkedTopicData, next){
					topics.getUserBookmark( newTopic.tid, topic.userId, next );
				},
				function ( bookmark, next ){
					assert.equal( originalBookmark, bookmark );
					next();
				}
			],done);
		});

		it('should update the user\'s bookmark ', function (done){
			async.waterfall([
				function (next){
					topics.createTopicFromPosts(
						topic.userId,
						'Fork test, no bookmark update',
						topicPids.slice( 1, 3 ),
						newTopic.tid,
						next );
				},
				function ( forkedTopicData, next){
					topics.getUserBookmark( newTopic.tid, topic.userId, next );
				},
				function ( bookmark, next ){
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
