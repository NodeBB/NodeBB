'use strict';
/*global require, process, after*/

var winston = require('winston');

process.on('uncaughtException', function (err) {
	winston.error('Encountered error while running test suite: ' + err.message);
});

var	assert = require('assert'),
	db = require('./mocks/databasemock');

var Categories = require('../src/categories');

describe('Categories', function() {
	var	categoryObj;

	describe('.create', function() {
		it('should create a new category', function(done) {

			Categories.create({
				name: 'Test Category',
				description: 'Test category created by testing script',
				icon: 'fa-check',
				blockclass: 'category-blue',
				order: '5'
			}, function(err, category) {
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
				end: -1,
				uid: 0
			}, function(err, categoryData) {
				assert(categoryData);
				assert.equal(categoryObj.name, categoryData.name);
				assert.equal(categoryObj.description, categoryData.description);

				done();
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
				assert(Array.isArray(result.topics));
				assert(result.topics.every(function(topic) {
					return topic instanceof Object && topic.uid === '1';
				}));

				done();
			});
		});
	});

	after(function() {
		db.flushdb();
	});
});
