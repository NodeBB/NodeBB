'use strict';
/*global require, after, before*/


var async = require('async');
var assert = require('assert');

var db = require('./mocks/databasemock');
var Categories = require('../src/categories');
var Topics = require('../src/topics');
var User = require('../src/user');

describe('Categories', function() {
	var categoryObj;
	var posterUid;

	before(function(done) {
		User.create({username: 'poster'}, function(err, _posterUid) {
			if (err) {
				return done(err);
			}

			posterUid = _posterUid;

			done();
		});
	});

	describe('.create', function() {
		it('should create a new category', function(done) {

			Categories.create({
				name: 'Test Category',
				description: 'Test category created by testing script',
				icon: 'fa-check',
				blockclass: 'category-blue',
				order: '5'
			}, function(err, category) {
				assert.equal(err, null);

				categoryObj = category;
				done.apply(this, arguments);
			});
		});
	});

	describe('.getCategoryById', function() {
		it('should retrieve a newly created category by its ID', function(done) {
			Categories.getCategoryById({
				cid: categoryObj.cid,
				set: 'cid:' + categoryObj.cid + ':tids',
				reverse: true,
				start: 0,
				stop: -1,
				uid: 0
			}, function(err, categoryData) {
				assert.equal(err, null);

				assert(categoryData);
				assert.equal(categoryObj.name, categoryData.name);
				assert.equal(categoryObj.description, categoryData.description);

				done();
			});
		});
	});

	describe('Categories.getRecentTopicReplies', function() {
		it('should not throw', function(done) {
			Categories.getCategoryById({
				cid: categoryObj.cid,
				set: 'cid:' + categoryObj.cid + ':tids',
				reverse: true,
				start: 0,
				stop: -1,
				uid: 0
			}, function(err, categoryData) {
				assert.ifError(err);
				Categories.getRecentTopicReplies(categoryData, 0, function(err) {
					assert.ifError(err);
					done();
				});
			});
		});
	});

	describe('.getCategoryTopics', function() {
		it('should return a list of topics', function(done) {
			Categories.getCategoryTopics({
				cid: categoryObj.cid,
				set: 'cid:' + categoryObj.cid + ':tids',
				reverse: true,
				start: 0,
				stop: 10,
				uid: 0
			}, function(err, result) {
				assert.equal(err, null);

				assert(Array.isArray(result.topics));
				assert(result.topics.every(function(topic) {
					return topic instanceof Object;
				}));

				done();
			});
		});

		it('should return a list of topics by a specific user', function(done) {
			Categories.getCategoryTopics({
				cid: categoryObj.cid,
				set: 'cid:' + categoryObj.cid + ':uid:' + 1 + ':tids',
				reverse: true,
				start: 0,
				stop: 10,
				uid: 0,
				targetUid: 1
			}, function(err, result) {
				assert.equal(err, null);
				assert(Array.isArray(result.topics));
				assert(result.topics.every(function(topic) {
					return topic instanceof Object && topic.uid === '1';
				}));

				done();
			});
		});
	});

	describe('Categories.moveRecentReplies', function() {
		var moveCid;
		var moveTid;
		before(function(done) {
			async.parallel({
				category: function(next) {
					Categories.create({
						name: 'Test Category 2',
						description: 'Test category created by testing script'
					}, next);
				},
				topic: function(next) {
					Topics.post({
						uid: posterUid,
						cid: categoryObj.cid,
						title: 'Test Topic Title',
						content: 'The content of test topic'
					}, next);
				}
			}, function(err, results) {
				if (err) {
					return done(err);
				}
				moveCid = results.category.cid;
				moveTid = results.topic.topicData.tid;
				Topics.reply({uid: posterUid, content: 'test post', tid: moveTid}, function(err) {
					done(err);
				});
			});
		});

		it('should move posts from one category to another', function(done) {
			Categories.moveRecentReplies(moveTid, categoryObj.cid, moveCid, function(err) {
				assert.ifError(err);
				db.getSortedSetRange('cid:' + categoryObj.cid + ':pids', 0, -1, function(err, pids) {
					assert.ifError(err);
					assert.equal(pids.length, 0);
					db.getSortedSetRange('cid:' + moveCid + ':pids', 0, -1, function(err, pids) {
						assert.ifError(err);
						assert.equal(pids.length, 2);
						done();
					});
				});
			});
		});
	});

	after(function(done) {
		db.flushdb(done);
	});
});
