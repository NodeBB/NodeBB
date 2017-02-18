'use strict';

var async = require('async');
var	assert = require('assert');
var nconf = require('nconf');
var path = require('path');

var db = require('./mocks/databasemock');
var categories = require('../src/categories');
var topics = require('../src/topics');
var user = require('../src/user');
var groups = require('../src/groups');
var privileges = require('../src/privileges');
var meta = require('../src/meta');
var helpers = require('./helpers');


describe('Upload Controllers', function () {

	var tid;
	var cid;
	var pid;
	var adminUid;
	var regularUid;

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
				user.create({username: 'regular', password: 'zugzug'}, next);
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

	describe('regular user uploads', function () {
		var jar;
		var csrf_token;

		before(function (done) {
			helpers.loginUser('regular', 'zugzug', function (err, _jar, io, _csrf_token) {
				assert.ifError(err);
				jar = _jar;
				csrf_token = _csrf_token;
				privileges.categories.give(['upload:post:file'], cid, 'registered-users', done);
			});
		});

		it('should upload a profile picture', function (done) {
			helpers.uploadFile(nconf.get('url') + '/api/user/regular/uploadpicture', path.join(__dirname, '../public/logo.png'), {}, jar, csrf_token, function (err, res, body) {
				assert.ifError(err);
				assert.equal(res.statusCode, 200);
				assert(Array.isArray(body));
				assert.equal(body.length, 1);
				assert.equal(body[0].url, '/assets/uploads/profile/' + regularUid + '-profileimg.png');
				done();
			});
		});

		it('should upload an image to a post', function (done) {
			helpers.uploadFile(nconf.get('url') + '/api/post/upload', path.join(__dirname, '../public/logo.png'), {cid: cid}, jar, csrf_token, function (err, res, body) {
				assert.ifError(err);
				assert.equal(res.statusCode, 200);
				assert(Array.isArray(body));
				assert(body[0].path);
				assert(body[0].url);
				done();
			});
		});


		it('should upload a file to a post', function (done) {
			meta.config.allowFileUploads = 1;
			helpers.uploadFile(nconf.get('url') + '/api/post/upload', path.join(__dirname, '../public/503.html'), {cid: cid}, jar, csrf_token, function (err, res, body) {
				assert.ifError(err);
				assert.equal(res.statusCode, 200);
				assert(Array.isArray(body));
				assert(body[0].path);
				assert(body[0].url);
				done();
			});
		});

	});


	describe('admin uploads', function () {
		var jar;
		var csrf_token;

		before(function (done) {
			helpers.loginUser('admin', 'barbar', function (err, _jar, io, _csrf_token) {
				assert.ifError(err);
				jar = _jar;
				csrf_token = _csrf_token;
				groups.join('administrators', adminUid, done);
			});
		});

		it('should upload site logo', function (done) {
			helpers.uploadFile(nconf.get('url') + '/api/admin/uploadlogo', path.join(__dirname, '../public/logo.png'), {}, jar, csrf_token, function (err, res, body) {
				assert.ifError(err);
				assert.equal(res.statusCode, 200);
				assert(Array.isArray(body));
				assert.equal(body[0].url, '/assets/uploads/system/site-logo.png');
				done();
			});
		});

		it('should upload category image', function (done) {
			helpers.uploadFile(nconf.get('url') + '/api/admin/category/uploadpicture', path.join(__dirname, '../public/logo.png'), {params: JSON.stringify({cid: cid})}, jar, csrf_token, function (err, res, body) {
				assert.ifError(err);
				assert.equal(res.statusCode, 200);
				assert(Array.isArray(body));
				assert.equal(body[0].url, '/assets/uploads/category/category-1.png');
				done();
			});
		});

		it('should upload favicon', function (done) {
			helpers.uploadFile(nconf.get('url') + '/api/admin/uploadfavicon', path.join(__dirname, '../public/favicon.ico'), {}, jar, csrf_token, function (err, res, body) {
				assert.ifError(err);
				assert.equal(res.statusCode, 200);
				assert(Array.isArray(body));
				assert.equal(body[0].url, '/assets/uploads/system/favicon.ico');
				done();
			});
		});

		it('should upload touch icon', function (done) {
			helpers.uploadFile(nconf.get('url') + '/api/admin/uploadTouchIcon', path.join(__dirname, '../public/logo.png'), {}, jar, csrf_token, function (err, res, body) {
				assert.ifError(err);
				assert.equal(res.statusCode, 200);
				assert(Array.isArray(body));
				assert.equal(body[0].url, '/assets/uploads/system/touchicon-orig.png');
				done();
			});
		});
	});


	after(function (done) {
		db.emptydb(done);
	});
});
