'use strict';
/*global require, before, beforeEach, after*/

var	assert = require('assert');
var validator = require('validator');
var db = require('./mocks/databasemock');
var topics = require('../src/topics');
var categories = require('../src/categories');
var User = require('../src/user');
var groups = require('../src/groups');
var async = require('async');

describe('Topic\'s', function() {
	var topic,
		categoryObj;

	before(function(done) {
		var userData = {
				username: 'John Smith',
				password: 'swordfish',
				email: 'john@example.com',
				callback: undefined
			};

		User.create({username: userData.username, password: userData.password, email: userData.email}, function(err, uid) {
			categories.create({
				name: 'Test Category',
				description: 'Test category created by testing script',
				icon: 'fa-check',
				blockclass: 'category-blue',
				order: '5'
			}, function(err, category) {
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

	describe('.post', function() {

		it('should create a new topic with proper parameters', function(done) {
			topics.post({uid: topic.userId, title: topic.title, content: topic.content, cid: topic.categoryId}, function(err, result) {
				assert.equal(err, null, 'was created with error');
				assert.ok(result);

				done();
			});
		});

		it('should fail to create new topic with invalid user id', function(done) {
			topics.post({uid: null, title: topic.title, content: topic.content, cid: topic.categoryId}, function(err, result) {
				assert.equal(err.message, '[[error:no-privileges]]');
				done();
			});
		});

		it('should fail to create new topic with empty title', function(done) {
			topics.post({uid: topic.userId, title: '', content: topic.content, cid: topic.categoryId}, function(err, result) {
				assert.ok(err);
				done();
			});
		});

		it('should fail to create new topic with empty content', function(done) {
			topics.post({uid: topic.userId, title: topic.title, content: '', cid: topic.categoryId}, function(err, result) {
				assert.ok(err);
				done();
			});
		});

		it('should fail to create new topic with non-existant category id', function(done) {
			topics.post({uid: topic.userId, title: topic.title, content: topic.content, cid: 99}, function(err, result) {
				assert.equal(err.message, '[[error:no-category]]', 'received no error');
				done();
			});
		});
	});

	describe('.reply', function() {
		var newTopic;
		var newPost;

		before(function(done) {
			topics.post({uid: topic.userId, title: topic.title, content: topic.content, cid: topic.categoryId}, function(err, result) {
				newTopic = result.topicData;
				newPost = result.postData;
				done();
			});
		});

		it('should create a new reply with proper parameters', function(done) {
			topics.reply({uid: topic.userId, content: 'test post', tid: newTopic.tid}, function(err, result) {
				assert.equal(err, null, 'was created with error');
				assert.ok(result);

				done();
			});
		});

		it('should fail to create new reply with invalid user id', function(done) {
			topics.reply({uid: null, content: 'test post', tid: newTopic.tid}, function(err, result) {
				assert.equal(err.message, '[[error:no-privileges]]');
				done();
			});
		});

		it('should fail to create new reply with empty content', function(done) {
			topics.reply({uid: topic.userId, content: '', tid: newTopic.tid}, function(err, result) {
				assert.ok(err);
				done();
			});
		});

		it('should fail to create new reply with invalid topic id', function(done) {
			topics.reply({uid: null, content: 'test post', tid: 99}, function(err, result) {
				assert.equal(err.message, '[[error:no-topic]]');
				done();
			});
		});
	});

	describe('Get methods', function() {
		var	newTopic;
		var newPost;

		beforeEach(function(done) {
			topics.post({uid: topic.userId, title: topic.title, content: topic.content, cid: topic.categoryId}, function(err, result) {
				newTopic = result.topicData;
				newPost = result.postData;
				done();
			});
		});

		describe('.getTopicData', function() {
			it('should not receive errors', function(done) {
				topics.getTopicData(newTopic.tid, done);
			});
		});
	});

	describe('Title escaping', function() {

		it('should properly escape topic title', function(done) {
			var title = '"<script>alert(\'ok1\');</script> new topic test';
			var titleEscaped = validator.escape(title);
			topics.post({uid: topic.userId, title: title, content: topic.content, cid: topic.categoryId}, function(err, result) {
				assert.ifError(err);
				topics.getTopicData(result.topicData.tid, function(err, topicData) {
					assert.ifError(err);
					assert.strictEqual(topicData.titleRaw, title);
					assert.strictEqual(topicData.title, titleEscaped);
					done();
				});
			});
		});
	});

	describe('.purge/.delete', function() {
		var newTopic;

		before(function(done) {
			topics.post({uid: topic.userId, title: topic.title, content: topic.content, cid: topic.categoryId}, function(err, result) {
				newTopic = result.topicData;
				done();
			});
		});

		it('should delete the topic', function(done) {
			topics.delete(newTopic.tid, 1, function(err) {
				assert.ifError(err);
				done();
			});
		});

		it('should purge the topic', function(done) {
			topics.purge(newTopic.tid, 1, function(err) {
				assert.ifError(err);
				done();
			});
		});
	});


	describe('.fork', function(){
		var newTopic;
		var replies = new Array();
		var topicPids;
		var originalBookmark = 5;
		function postReply( next ){
			topics.reply({uid: topic.userId, content: 'test post ' + replies.length, tid: newTopic.tid},
				function(err, result) {
					assert.equal(err, null, 'was created with error');
					assert.ok(result);
					replies.push( result );
					next();
				}
			);
		}

		before( function(done) {
			async.waterfall(
				[
				function(next){
					groups.join('administrators', topic.userId, next);
				},
				function( next ){
					topics.post({uid: topic.userId, title: topic.title, content: topic.content, cid: topic.categoryId}, function(err, result) {
						assert.ifError( err );
						newTopic = result.topicData;
						next();
					});
				},
				function( next ){ postReply( next );},
				function( next ){ postReply( next );},
				function( next ){ postReply( next );},
				function( next ){ postReply( next );},
				function( next ){ postReply( next );},
				function( next ){ postReply( next );},
				function( next ){ postReply( next );},
				function( next ){ postReply( next );},
				function( next ){ postReply( next );},
				function( next ){ postReply( next );},
				function( next ){ postReply( next );},
				function( next ){ postReply( next );},
				function( next ){
					topicPids = replies.map( function( reply ){ return reply.pid; } );
					topics.setUserBookmark( newTopic.tid, topic.userId, originalBookmark, next );
				}],
				done );
		});

		it('should have 12 replies', function(done) {
			assert.equal( 12, replies.length );
			done();
		});

		it('should not update the user\'s bookmark', function(done){
			async.waterfall([
				function(next){
					topics.createTopicFromPosts(
						topic.userId,
						'Fork test, no bookmark update',
						topicPids.slice( -2 ),
						newTopic.tid,
						next );
				},
				function( forkedTopicData, next){
					topics.getUserBookmark( newTopic.tid, topic.userId, next );
				},
				function( bookmark, next ){
					assert.equal( originalBookmark, bookmark );
					next();
				}
			],done);
		});

		it('should update the user\'s bookmark ', function(done){
			async.waterfall([
				function(next){
					topics.createTopicFromPosts(
						topic.userId,
						'Fork test, no bookmark update',
						topicPids.slice( 1, 3 ),
						newTopic.tid,
						next );
				},
				function( forkedTopicData, next){
					topics.getUserBookmark( newTopic.tid, topic.userId, next );
				},
				function( bookmark, next ){
					assert.equal( originalBookmark - 2, bookmark );
					next();
				}
			],done);
		});
	});

	after(function() {
		db.flushdb();
	});
});
