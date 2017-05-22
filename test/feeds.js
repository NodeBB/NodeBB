'use strict';

var assert = require('assert');
var async = require('async');
var request = require('request');
var nconf = require('nconf');

var db = require('./mocks/databasemock');
var topics = require('../src/topics');
var categories = require('../src/categories');
var groups = require('../src/groups');
var user = require('../src/user');
var meta = require('../src/meta');
var privileges = require('../src/privileges');

describe('feeds', function () {
	var tid;
	var pid;
	var fooUid;
	var cid;
	before(function (done) {
		groups.resetCache();
		meta.config['feeds:disableRSS'] = 1;
		async.series({
			category: function (next) {
				categories.create({
					name: 'Test Category',
					description: 'Test category created by testing script',
				}, next);
			},
			user: function (next) {
				user.create({ username: 'foo', password: 'barbar', email: 'foo@test.com' }, next);
			},
		}, function (err, results) {
			if (err) {
				return done(err);
			}
			cid = results.category.cid;
			fooUid = results.user;

			topics.post({ uid: results.user, title: 'test topic title', content: 'test topic content', cid: results.category.cid }, function (err, result) {
				tid = result.topicData.tid;
				pid = result.postData.pid;
				done(err);
			});
		});
	});


	it('should 404', function (done) {
		var feedUrls = [
			nconf.get('url') + '/topic/' + tid + '.rss',
			nconf.get('url') + '/category/' + cid + '.rss',
			nconf.get('url') + '/recent.rss',
			nconf.get('url') + '/popular.rss',
			nconf.get('url') + '/popular/day.rss',
			nconf.get('url') + '/recentposts.rss',
			nconf.get('url') + '/category/' + cid + '/recentposts.rss',
			nconf.get('url') + '/user/foo/topics.rss',
			nconf.get('url') + '/tags/nodebb.rss',
		];
		async.eachSeries(feedUrls, function (url, next) {
			request(url, function (err, res) {
				assert.ifError(err);
				assert.equal(res.statusCode, 404);
				next();
			});
		}, function (err) {
			assert.ifError(err);
			meta.config['feeds:disableRSS'] = 0;
			done();
		});
	});

	it('should 404 if topic does not exist', function (done) {
		request(nconf.get('url') + '/topic/' + 1000 + '.rss', function (err, res) {
			assert.ifError(err);
			assert.equal(res.statusCode, 404);
			done();
		});
	});

	it('should redirect if we do not have read privilege', function (done) {
		privileges.categories.rescind(['topics:read'], cid, 'guests', function (err) {
			assert.ifError(err);
			request(nconf.get('url') + '/topic/' + tid + '.rss', function (err, res, body) {
				assert.ifError(err);
				assert.equal(res.statusCode, 200);
				assert(body);
				assert(body.indexOf('Login to your account') !== -1);
				privileges.categories.give(['topics:read'], cid, 'guests', done);
			});
		});
	});

	it('should 404 if user is not found', function (done) {
		request(nconf.get('url') + '/user/doesnotexist/topics.rss', function (err, res) {
			assert.ifError(err);
			assert.equal(res.statusCode, 404);
			done();
		});
	});

	it('should redirect if we do not have read privilege', function (done) {
		privileges.categories.rescind(['read'], cid, 'guests', function (err) {
			assert.ifError(err);
			request(nconf.get('url') + '/category/' + cid + '.rss', function (err, res, body) {
				assert.ifError(err);
				assert.equal(res.statusCode, 200);
				assert(body);
				assert(body.indexOf('Login to your account') !== -1);
				privileges.categories.give(['read'], cid, 'guests', done);
			});
		});
	});

	after(function (done) {
		db.emptydb(done);
	});
});
