var	assert = require('assert'),
	RDB = require('../src/redis'),
	Categories = require('../src/categories');

describe('Categories', function() {
	var	categoryObj;

	describe('.create', function() {
		it('should create a new category', function(done) {
			Categories.create({
				name: 'Test Category',
				description: 'Test category created by testing script',
				icon: 'icon-ok',
				blockclass: 'category-blue',
				order: '5'
			}, function(err, category) {
				categoryObj = category;
				done.apply(arguments);
			});
		});
	});

	describe('.getCategoryById', function() {
		it('should retrieve a newly created category by its ID', function(done) {
			Categories.getCategoryById(categoryObj.cid, 0, function(err, categoryData) {
				assert(categoryData);
				assert.equal(categoryObj.name, categoryData.category_name);
				assert.equal(categoryObj.description, categoryData.category_description);

				done();
			});
		});
	});

	describe('.getCategoryTopics', function() {
		it('should return a list of topics', function(done) {
			Categories.getCategoryTopics(categoryObj.cid, 0, 10, 0, function(topics) {
				assert(Array.isArray(topics));
				assert(topics.every(function(topic) {
					return topic instanceof Object;
				}));

				done();
			});
		});
	});

	after(function() {
		RDB.multi()
			.del('category:'+categoryObj.cid)
			.rpop('categories:cid')
		.exec();
	});
});