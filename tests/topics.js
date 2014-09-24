'use strict';

var	assert = require('assert'),
	db = require('./mocks/databasemock'),
	topics = require('../src/topics'),
	categories = require('../src/categories'),
	User = require('../src/user');

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

		it('should fail to create new topic with wrong parameters', function(done) {
			topics.post({uid: null, title: topic.title, content: topic.content, cid: topic.categoryId}, function(err, result) {
				assert.equal(err.message, '[[error:no-user]]');
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

		describe('.getTopicDataWithUser', function() {
			it('should not receive errors', function(done) {
				topics.getTopicDataWithUser(newTopic.tid, done);
			});
		});
	});

	after(function() {
		db.flushdb();
	});
});
