'use strict';

var async = require('async');
var	assert = require('assert');
var nconf = require('nconf');
var request = require('request');

var db = require('./mocks/databasemock');
var categories = require('../src/categories');
var topics = require('../src/topics');
var user = require('../src/user');
var meta = require('../src/meta');


describe('Controllers', function () {

	var tid;
	var cid;
	var pid;
	var fooUid;

	before(function (done) {
		async.series({
			category: function (next) {
				categories.create({
					name: 'Test Category',
					description: 'Test category created by testing script'
				}, next);
			},
			user: function (next) {
				user.create({username: 'foo', password: 'barbar'}, next);
			}
		}, function (err, results) {
			if (err) {
				return done(err);
			}
			cid = results.category.cid;
			fooUid = results.user;

			topics.post({uid: results.user, title: 'test topic title', content: 'test topic content', cid: results.category.cid}, function (err, result) {
				tid = result.topicData.tid;
				pid = result.postData.pid;
				done(err);
			});
		});
	});

	it('should load default home route', function (done) {
		request(nconf.get('url'), function (err, res, body) {
			assert.ifError(err);
			assert.equal(res.statusCode, 200);
			assert(body);
			done();
		});
	});

	it('should load unread as home route', function (done) {
		meta.config.homePageRoute = 'unread';
		request(nconf.get('url'), function (err, res, body) {
			assert.ifError(err);
			assert.equal(res.statusCode, 200);
			assert(body);
			done();
		});
	});

	it('should load recent as home route', function (done) {
		meta.config.homePageRoute = 'recent';
		request(nconf.get('url'), function (err, res, body) {
			assert.ifError(err);
			assert.equal(res.statusCode, 200);
			assert(body);
			done();
		});
	});

	it('should load popular as home route', function (done) {
		meta.config.homePageRoute = 'popular';
		request(nconf.get('url'), function (err, res, body) {
			assert.ifError(err);
			assert.equal(res.statusCode, 200);
			assert(body);
			done();
		});
	});

	it('should load category as home route', function (done) {
		meta.config.homePageRoute = 'category/1/test-category';
		request(nconf.get('url'), function (err, res, body) {
			assert.ifError(err);
			assert.equal(res.statusCode, 200);
			assert(body);
			done();
		});
	});

	it('should load /reset without code', function (done) {
		request(nconf.get('url') + '/reset', function (err, res, body) {
			assert.ifError(err);
			assert.equal(res.statusCode, 200);
			assert(body);
			done();
		});
	});

	it('should load /reset with invalid code', function (done) {
		request(nconf.get('url') + '/reset/123123', function (err, res, body) {
			assert.ifError(err);
			assert.equal(res.statusCode, 200);
			assert(body);
			done();
		});
	});

	it('should load /login', function (done) {
		request(nconf.get('url') + '/login', function (err, res, body) {
			assert.ifError(err);
			assert.equal(res.statusCode, 200);
			assert(body);
			done();
		});
	});

	it('should load /register', function (done) {
		request(nconf.get('url') + '/register', function (err, res, body) {
			assert.ifError(err);
			assert.equal(res.statusCode, 200);
			assert(body);
			done();
		});
	});

	it('should load /robots.txt', function (done) {
		request(nconf.get('url') + '/robots.txt', function (err, res, body) {
			assert.ifError(err);
			assert.equal(res.statusCode, 200);
			assert(body);
			done();
		});
	});

	it('should load /manifest.json', function (done) {
		request(nconf.get('url') + '/manifest.json', function (err, res, body) {
			assert.ifError(err);
			assert.equal(res.statusCode, 200);
			assert(body);
			done();
		});
	});

	it('should load /outgoing?url=<url>', function (done) {
		request(nconf.get('url') + '/outgoing?url=http//youtube.com', function (err, res, body) {
			assert.ifError(err);
			assert.equal(res.statusCode, 200);
			assert(body);
			done();
		});
	});

	it('should 404 on /outgoing with no url', function (done) {
		request(nconf.get('url') + '/outgoing', function (err, res, body) {
			assert.ifError(err);
			assert.equal(res.statusCode, 404);
			assert(body);
			done();
		});
	});

	it('should load /tos', function (done) {
		meta.config.termsOfUse = 'please accept our tos';
		request(nconf.get('url') + '/tos', function (err, res, body) {
			assert.ifError(err);
			assert.equal(res.statusCode, 200);
			assert(body);
			done();
		});
	});


	it('should load 404 if meta.config.termsOfUse is empty', function (done) {
		meta.config.termsOfUse = '';
		request(nconf.get('url') + '/tos', function (err, res, body) {
			assert.ifError(err);
			assert.equal(res.statusCode, 404);
			assert(body);
			done();
		});
	});

	it('should load /sping', function (done) {
		request(nconf.get('url') + '/sping', function (err, res, body) {
			assert.ifError(err);
			assert.equal(res.statusCode, 200);
			assert.equal(body, 'healthy');
			done();
		});
	});

	it('should load /ping', function (done) {
		request(nconf.get('url') + '/ping', function (err, res, body) {
			assert.ifError(err);
			assert.equal(res.statusCode, 200);
			assert.equal(body, '200');
			done();
		});
	});

	it('should handle 404', function (done) {
		request(nconf.get('url') + '/arouteinthevoid', function (err, res, body) {
			assert.ifError(err);
			assert.equal(res.statusCode, 404);
			assert(body);
			done();
		});
	});

	it('should load topic rss feed', function (done) {
		request(nconf.get('url') + '/topic/' + tid + '.rss', function (err, res, body) {
			assert.ifError(err);
			assert.equal(res.statusCode, 200);
			assert(body);
			done();
		});
	});

	it('should load category rss feed', function (done) {
		request(nconf.get('url') + '/category/' + cid + '.rss', function (err, res, body) {
			assert.ifError(err);
			assert.equal(res.statusCode, 200);
			assert(body);
			done();
		});
	});

	it('should load recent rss feed', function (done) {
		request(nconf.get('url') + '/recent.rss', function (err, res, body) {
			assert.ifError(err);
			assert.equal(res.statusCode, 200);
			assert(body);
			done();
		});
	});

	it('should load popular rss feed', function (done) {
		request(nconf.get('url') + '/popular.rss', function (err, res, body) {
			assert.ifError(err);
			assert.equal(res.statusCode, 200);
			assert(body);
			done();
		});
	});

	it('should load popular rss feed with term', function (done) {
		request(nconf.get('url') + '/popular/day.rss', function (err, res, body) {
			assert.ifError(err);
			assert.equal(res.statusCode, 200);
			assert(body);
			done();
		});
	});

	it('should load recent posts rss feed', function (done) {
		request(nconf.get('url') + '/recentposts.rss', function (err, res, body) {
			assert.ifError(err);
			assert.equal(res.statusCode, 200);
			assert(body);
			done();
		});
	});

	it('should load category recent posts rss feed', function (done) {
		request(nconf.get('url') + '/category/' + cid + '/recentposts.rss', function (err, res, body) {
			assert.ifError(err);
			assert.equal(res.statusCode, 200);
			assert(body);
			done();
		});
	});

	it('should load user topics rss feed', function (done) {
		request(nconf.get('url') + '/user/foo/topics.rss', function (err, res, body) {
			assert.ifError(err);
			assert.equal(res.statusCode, 200);
			assert(body);
			done();
		});
	});

	it('should load stylesheet.css', function (done) {
		request(nconf.get('url') + '/stylesheet.css', function (err, res, body) {
			assert.ifError(err);
			assert.equal(res.statusCode, 200);
			assert(body);
			done();
		});
	});

	it('should load admin.css', function (done) {
		request(nconf.get('url') + '/admin.css', function (err, res, body) {
			assert.ifError(err);
			assert.equal(res.statusCode, 200);
			assert(body);
			done();
		});
	});


	it('should load nodebb.min.js', function (done) {
		request(nconf.get('url') + '/nodebb.min.js', function (err, res, body) {
			assert.ifError(err);
			assert.equal(res.statusCode, 200);
			assert(body);
			done();
		});
	});

	it('should load acp.min.js', function (done) {
		request(nconf.get('url') + '/acp.min.js', function (err, res, body) {
			assert.ifError(err);
			assert.equal(res.statusCode, 200);
			assert(body);
			done();
		});
	});

	it('should load sitemap.xml', function (done) {
		request(nconf.get('url') + '/sitemap.xml', function (err, res, body) {
			assert.ifError(err);
			assert.equal(res.statusCode, 200);
			assert(body);
			done();
		});
	});

	it('should load sitemap/pages.xml', function (done) {
		request(nconf.get('url') + '/sitemap/pages.xml', function (err, res, body) {
			assert.ifError(err);
			assert.equal(res.statusCode, 200);
			assert(body);
			done();
		});
	});

	it('should load sitemap/categories.xml', function (done) {
		request(nconf.get('url') + '/sitemap/categories.xml', function (err, res, body) {
			assert.ifError(err);
			assert.equal(res.statusCode, 200);
			assert(body);
			done();
		});
	});

	it('should load sitemap/topics/1.xml', function (done) {
		request(nconf.get('url') + '/sitemap/topics.1.xml', function (err, res, body) {
			assert.ifError(err);
			assert.equal(res.statusCode, 200);
			assert(body);
			done();
		});
	});

	it('should load robots.txt', function (done) {
		request(nconf.get('url') + '/robots.txt', function (err, res, body) {
			assert.ifError(err);
			assert.equal(res.statusCode, 200);
			assert(body);
			done();
		});
	});

	it('should load manifest.json', function (done) {
		request(nconf.get('url') + '/manifest.json', function (err, res, body) {
			assert.ifError(err);
			assert.equal(res.statusCode, 200);
			assert(body);
			done();
		});
	});

	it('should load theme screenshot', function (done) {
		request(nconf.get('url') + '/css/previews/nodebb-theme-persona', function (err, res, body) {
			assert.ifError(err);
			assert.equal(res.statusCode, 200);
			assert(body);
			done();
		});
	});

	it('should load users page', function (done) {
		request(nconf.get('url') + '/users', function (err, res, body) {
			assert.ifError(err);
			assert.equal(res.statusCode, 200);
			assert(body);
			done();
		});
	});

	it('should load users page', function (done) {
		request(nconf.get('url') + '/users?section=online', function (err, res, body) {
			assert.ifError(err);
			assert.equal(res.statusCode, 200);
			assert(body);
			done();
		});
	});

	it('should load users search page', function (done) {
		request(nconf.get('url') + '/users?term=bar&section=sort-posts', function (err, res, body) {
			assert.ifError(err);
			assert.equal(res.statusCode, 200);
			assert(body);
			done();
		});
	});

	it('should load groups page', function (done) {
		request(nconf.get('url') + '/groups', function (err, res, body) {
			assert.ifError(err);
			assert.equal(res.statusCode, 200);
			assert(body);
			done();
		});
	});

	it('should load group details page', function (done) {
		var groups = require('../src/groups');
		groups.create({
			name: 'group-details',
			description: 'Foobar!',
			hidden: 0
		}, function (err) {
			assert.ifError(err);
			request(nconf.get('url') + '/groups/group-details', function (err, res, body) {
				assert.ifError(err);
				assert.equal(res.statusCode, 200);
				assert(body);
				done();
			});
		});
	});

	it('should load group members page', function (done) {
		request(nconf.get('url') + '/groups/group-details/members', function (err, res, body) {
			assert.ifError(err);
			assert.equal(res.statusCode, 200);
			assert(body);
			done();
		});
	});

	it('should 404 when trying to load group members of hidden group', function (done) {
		var groups = require('../src/groups');
		groups.create({
			name: 'hidden-group',
			description: 'Foobar!',
			hidden: 1
		}, function (err) {
			assert.ifError(err);
			request(nconf.get('url') + '/groups/hidden-group/members', function (err, res, body) {
				assert.ifError(err);
				assert.equal(res.statusCode, 404);
				done();
			});
		});
	});

	it('should get post data', function (done) {
		request(nconf.get('url') + '/api/post/pid/' + pid, function (err, res, body) {
			assert.ifError(err);
			assert.equal(res.statusCode, 200);
			assert(body);
			done();
		});
	});

	it('should get topic data', function (done) {
		request(nconf.get('url') + '/api/topic/tid/' + tid, function (err, res, body) {
			assert.ifError(err);
			assert.equal(res.statusCode, 200);
			assert(body);
			done();
		});
	});

	it('should get category data', function (done) {
		request(nconf.get('url') + '/api/category/cid/' + cid, function (err, res, body) {
			assert.ifError(err);
			assert.equal(res.statusCode, 200);
			assert(body);
			done();
		});
	});

	after(function (done) {
		db.emptydb(done);
	});
});
