
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
			Categories.getCategoryById(categoryObj.cid, 0, -1, 0, function(err, categoryData) {
				assert(categoryData);
				assert.equal(categoryObj.name, categoryData.name);
				assert.equal(categoryObj.description, categoryData.description);

				done();
			});
		});
	});

	describe('.getCategoryTopics', function() {
		it('should return a list of topics', function(done) {
			Categories.getCategoryTopics(categoryObj.cid, 0, 10, 0, function(err, result) {
				assert(Array.isArray(result.topics));
				assert(result.topics.every(function(topic) {
					return topic instanceof Object;
				}));

				done();
			});
		});
	});

	after(function() {
		db.delete('category:' + categoryObj.cid);
		db.sortedSetRemove('categories:cid', categoryObj.cid);
	});
});
