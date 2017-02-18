'use strict';

var async = require('async');
var	assert = require('assert');
var nconf = require('nconf');
var request = require('request');

var db = require('./mocks/databasemock');
var categories = require('../src/categories');
var topics = require('../src/topics');
var user = require('../src/user');
var groups = require('../src/groups');
var helpers = require('./helpers');

describe('Admin Controllers', function () {

	var tid;
	var cid;
	var pid;
	var adminUid;
	var regularUid;
	var jar;

	before(function (done) {
		async.series({
			category: function (next) {
				categories.create({
					name: 'Test Category',
					description: 'Test category created by testing script',
				}, next);
			},
			adminUid: function (next) {
				user.create({username: 'admin', password: 'barbar'}, next);
			},
			regularUid: function (next) {
				user.create({username: 'regular'}, next);
			},
		}, function (err, results) {
			if (err) {
				return done(err);
			}
			adminUid = results.adminUid;
			regularUid = results.regularUid;
			cid = results.category.cid;

			topics.post({uid: adminUid, title: 'test topic title', content: 'test topic content', cid: results.category.cid}, function (err, result) {
				tid = result.topicData.tid;
				pid = result.postData.pid;
				done(err);
			});
		});
	});

	it('should 403 if user is not admin', function (done) {
		helpers.loginUser('admin', 'barbar', function (err, _jar) {
			assert.ifError(err);
			jar = _jar;
			request(nconf.get('url') + '/admin', {jar: jar}, function (err, res, body) {
				assert.ifError(err);
				assert.equal(res.statusCode, 403);
				assert(body);
				done();
			});
		});
	});

	it('should load admin dashboard', function (done) {
		groups.join('administrators', adminUid, function (err) {
			assert.ifError(err);
			request(nconf.get('url') + '/admin', {jar: jar}, function (err, res, body) {
				assert.ifError(err);
				assert.equal(res.statusCode, 200);
				assert(body);
				done();
			});
		});
	});

	it('should load groups page', function (done) {
		request(nconf.get('url') + '/admin/manage/groups', {jar: jar}, function (err, res, body) {
			assert.ifError(err);
			assert.equal(res.statusCode, 200);
			assert(body);
			done();
		});
	});

	it('should load groups detail page', function (done) {
		request(nconf.get('url') + '/admin/manage/groups/administrators', {jar: jar}, function (err, res, body) {
			assert.ifError(err);
			assert.equal(res.statusCode, 200);
			assert(body);
			done();
		});
	});


	it('should load general settings page', function (done) {
		request(nconf.get('url') + '/admin/settings', {jar: jar}, function (err, res, body) {
			assert.ifError(err);
			assert.equal(res.statusCode, 200);
			assert(body);
			done();
		});
	});

	it('should load email settings page', function (done) {
		request(nconf.get('url') + '/admin/settings/email', {jar: jar}, function (err, res, body) {
			assert.ifError(err);
			assert.equal(res.statusCode, 200);
			assert(body);
			done();
		});
	});

	it('should load info page for a user', function (done) {
		request(nconf.get('url') + '/api/user/regular/info', {jar: jar, json: true}, function (err, res, body) {
			assert.ifError(err);
			assert.equal(res.statusCode, 200);
			assert(body.history);
			assert(Array.isArray(body.history.flags));
			assert(Array.isArray(body.history.bans));
			assert(Array.isArray(body.history.reasons));
			assert(Array.isArray(body.sessions));
			done();
		});
	});

	it('should 404 for edit/email page if user does not exist', function (done) {
		request(nconf.get('url') + '/api/user/doesnotexist/edit/email', {jar: jar, json: true}, function (err, res, body) {
			assert.ifError(err);
			assert.equal(res.statusCode, 404);
			done();
		});
	});

	it('should load /admin/general/homepage', function (done) {
		request(nconf.get('url') + '/api/admin/general/homepage', {jar: jar, json: true}, function (err, res, body) {
			assert.ifError(err);
			assert.equal(res.statusCode, 200);
			assert(body.routes);
			done();
		});
	});

	it('should load /admin/advanced/database', function (done) {
		request(nconf.get('url') + '/api/admin/advanced/database', {jar: jar, json: true}, function (err, res, body) {
			assert.ifError(err);
			assert.equal(res.statusCode, 200);

			if (nconf.get('redis')) {
				assert(body.redis);
			} else if (nconf.get('mongo')) {
				assert(body.mongo);
			}
			done();
		});
	});

	it('should load /admin/extend/plugins', function (done) {
		request(nconf.get('url') + '/api/admin/extend/plugins', {jar: jar, json: true}, function (err, res, body) {
			assert.ifError(err);
			assert(body.hasOwnProperty('installed'));
			assert(body.hasOwnProperty('upgradeCount'));
			assert(body.hasOwnProperty('download'));
			assert(body.hasOwnProperty('incompatible'));
			done();
		});
	});

	it('should load /admin/manage/users', function (done) {
		request(nconf.get('url') + '/api/admin/manage/users', {jar: jar, json: true}, function (err, res, body) {
			assert.ifError(err);
			assert(body);
			done();
		});
	});

	it('should load /admin/manage/users/search', function (done) {
		request(nconf.get('url') + '/api/admin/manage/users/search', {jar: jar, json: true}, function (err, res, body) {
			assert.ifError(err);
			assert(body.users);
			done();
		});
	});

	it('should load /admin/manage/users/not-validated', function (done) {
		request(nconf.get('url') + '/api/admin/manage/users/not-validated', {jar: jar, json: true}, function (err, res, body) {
			assert.ifError(err);
			assert(body);
			done();
		});
	});

	it('should load /admin/manage/users/no-posts', function (done) {
		request(nconf.get('url') + '/api/admin/manage/users/no-posts', {jar: jar, json: true}, function (err, res, body) {
			assert.ifError(err);
			assert(body);
			done();
		});
	});

	it('should load /admin/manage/users/top-posters', function (done) {
		request(nconf.get('url') + '/api/admin/manage/users/top-posters', {jar: jar, json: true}, function (err, res, body) {
			assert.ifError(err);
			assert(body);
			done();
		});
	});

	it('should load /admin/manage/users/most-reputation', function (done) {
		request(nconf.get('url') + '/api/admin/manage/users/most-reputation', {jar: jar, json: true}, function (err, res, body) {
			assert.ifError(err);
			assert(body);
			done();
		});
	});

	it('should load /admin/manage/users/inactive', function (done) {
		request(nconf.get('url') + '/api/admin/manage/users/inactive', {jar: jar, json: true}, function (err, res, body) {
			assert.ifError(err);
			assert(body);
			done();
		});
	});

	it('should load /admin/manage/users/flagged', function (done) {
		request(nconf.get('url') + '/api/admin/manage/users/flagged', {jar: jar, json: true}, function (err, res, body) {
			assert.ifError(err);
			assert(body);
			done();
		});
	});

	it('should load /admin/manage/users/banned', function (done) {
		request(nconf.get('url') + '/api/admin/manage/users/banned', {jar: jar, json: true}, function (err, res, body) {
			assert.ifError(err);
			assert(body);
			done();
		});
	});

	it('should load /admin/manage/registration', function (done) {
		request(nconf.get('url') + '/api/admin/manage/registration', {jar: jar, json: true}, function (err, res, body) {
			assert.ifError(err);
			assert(body);
			done();
		});
	});

	it('should load /admin/users/csv', function (done) {
		request(nconf.get('url') + '/api/admin/users/csv', {jar: jar}, function (err, res, body) {
			assert.ifError(err);
			assert(body);
			done();
		});
	});

	it('should load /admin/manage/flags', function (done) {
		request(nconf.get('url') + '/api/admin/manage/flags', {jar: jar, json: true}, function (err, res, body) {
			assert.ifError(err);
			assert(body);
			done();
		});
	});

	it('should load /admin/advanced/cache', function (done) {
		request(nconf.get('url') + '/api/admin/advanced/cache', {jar: jar, json: true}, function (err, res, body) {
			assert.ifError(err);
			assert(body);
			done();
		});
	});

	it('should load /admin/advanced/errors', function (done) {
		request(nconf.get('url') + '/api/admin/advanced/errors', {jar: jar, json: true}, function (err, res, body) {
			assert.ifError(err);
			assert(body);
			done();
		});
	});

	it('should load /admin/advanced/errors/export', function (done) {
		request(nconf.get('url') + '/api/admin/advanced/errors/export', {jar: jar}, function (err, res, body) {
			assert.ifError(err);
			assert(body);
			done();
		});
	});

	it('should load /admin/advanced/logs', function (done) {
		request(nconf.get('url') + '/api/admin/advanced/logs', {jar: jar, json: true}, function (err, res, body) {
			assert.ifError(err);
			assert(body);
			done();
		});
	});

	it('should load /admin/general/navigation', function (done) {
		request(nconf.get('url') + '/api/admin/general/navigation', {jar: jar, json: true}, function (err, res, body) {
			assert.ifError(err);
			assert(body);
			done();
		});
	});

	it('should load /admin/development/info', function (done) {
		request(nconf.get('url') + '/api/admin/development/info', {jar: jar, json: true}, function (err, res, body) {
			assert.ifError(err);
			assert(body);
			done();
		});
	});

	it('should load /admin/development/logger', function (done) {
		request(nconf.get('url') + '/api/admin/development/logger', {jar: jar, json: true}, function (err, res, body) {
			assert.ifError(err);
			assert(body);
			done();
		});
	});

	it('should load /admin/advanced/events', function (done) {
		request(nconf.get('url') + '/api/admin/advanced/events', {jar: jar, json: true}, function (err, res, body) {
			assert.ifError(err);
			assert(body);
			done();
		});
	});

	it('should load /admin/general/sounds', function (done) {
		request(nconf.get('url') + '/api/admin/general/sounds', {jar: jar, json: true}, function (err, res, body) {
			assert.ifError(err);
			assert(body);
			done();
		});
	});

	it('should load /admin/manage/categories', function (done) {
		request(nconf.get('url') + '/api/admin/manage/categories', {jar: jar, json: true}, function (err, res, body) {
			assert.ifError(err);
			assert(body);
			done();
		});
	});

	it('should load /admin/manage/categories/1', function (done) {
		request(nconf.get('url') + '/api/admin/manage/categories/1', {jar: jar, json: true}, function (err, res, body) {
			assert.ifError(err);
			assert(body);
			done();
		});
	});

	it('should load /admin/manage/categories/1/analytics', function (done) {
		request(nconf.get('url') + '/api/admin/manage/categories/1/analytics', {jar: jar, json: true}, function (err, res, body) {
			assert.ifError(err);
			assert(body);
			done();
		});
	});

	it('should load /admin/extend/rewards', function (done) {
		request(nconf.get('url') + '/api/admin/extend/rewards', {jar: jar, json: true}, function (err, res, body) {
			assert.ifError(err);
			assert(body);
			done();
		});
	});

	it('should load /admin/extend/widgets', function (done) {
		request(nconf.get('url') + '/api/admin/extend/widgets', {jar: jar, json: true}, function (err, res, body) {
			assert.ifError(err);
			assert(body);
			done();
		});
	});

	it('should load /admin/general/languages', function (done) {
		request(nconf.get('url') + '/api/admin/general/languages', {jar: jar, json: true}, function (err, res, body) {
			assert.ifError(err);
			assert(body);
			done();
		});
	});

	it('should load /admin/general/social', function (done) {
		request(nconf.get('url') + '/api/admin/general/social', {jar: jar, json: true}, function (err, res, body) {
			assert.ifError(err);
			assert(body);
			done();
		});
	});

	it('should load /admin/manage/tags', function (done) {
		request(nconf.get('url') + '/api/admin/manage/tags', {jar: jar, json: true}, function (err, res, body) {
			assert.ifError(err);
			assert(body);
			done();
		});
	});

	it('should load /admin/manage/ip-blacklist', function (done) {
		request(nconf.get('url') + '/api/admin/manage/ip-blacklist', {jar: jar, json: true}, function (err, res, body) {
			assert.ifError(err);
			assert(body);
			done();
		});
	});

	it('should load /admin/appearance/themes', function (done) {
		request(nconf.get('url') + '/api/admin/appearance/themes', {jar: jar, json: true}, function (err, res, body) {
			assert.ifError(err);
			assert(body);
			done();
		});
	});

	it('should load /admin/appearance/customise', function (done) {
		request(nconf.get('url') + '/api/admin/appearance/customise', {jar: jar, json: true}, function (err, res, body) {
			assert.ifError(err);
			assert(body);
			done();
		});
	});

	it('should load /recent in maintenance mode', function (done) {
		var meta = require('../src/meta');
		meta.config.maintenanceMode = 1;
		request(nconf.get('url') + '/api/recent', {jar: jar, json: true}, function (err, res, body) {
			assert.ifError(err);
			assert.equal(res.statusCode, 200);
			assert(body);
			meta.config.maintenanceMode = 0;
			done();
		});
	});


	it('should load /posts/flags', function (done) {
		request(nconf.get('url') + '/api/posts/flags', {jar: jar, json: true}, function (err, res, body) {
			assert.ifError(err);
			assert(body);
			done();
		});
	});

	after(function (done) {
		db.emptydb(done);
	});
});
