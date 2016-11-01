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
					description: 'Test category created by testing script'
				}, next);
			},
			adminUid: function (next) {
				user.create({username: 'admin', password: 'barbar'}, next);
			},
			regularUid: function (next) {
				user.create({username: 'regular'}, next);
			}
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

	after(function (done) {
		db.emptydb(done);
	});
});
