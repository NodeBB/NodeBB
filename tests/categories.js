// this test currently needs to talk to the redis database.
// get the redis config info from root directory's config.json:
var nconf = require('nconf');
nconf.file({file: __dirname + '/../config.json'});

process.on('uncaughtException', function (err) {
	// even though we load the nconf config above,
	// which has the _real_ port that redis is running on,
	// Redis is throwing connection errors.
	//
	// Catching uncaught exceptions like this is frowned upon.
	// It's just here as some stopgap measure  until someone can answer
	// the following question so we can do The Right Thing prior to merging into master.
	//
	// Where is redis attempting to connect to port 6379 in this test?
	console.log(err);
});

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
				done.apply(this, arguments);
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