'use strict';


var	assert = require('assert');
var nconf = require('nconf');
var request = require('request');

var db = require('./mocks/databasemock');
var user = require('../src/user');

describe('authentication', function () {
	var jar = request.jar();
	var regularUid;
	before(function (done) {
		user.create({ username: 'regular', password: 'regularpwd', email: 'regular@nodebb.org' }, function (err, uid) {
			assert.ifError(err);
			regularUid = uid;
			done();
		});
	});

	it('should register and login a user', function (done) {
		request({
			url: nconf.get('url') + '/api/config',
			json: true,
			jar: jar,
		}, function (err, response, body) {
			assert.ifError(err);

			request.post(nconf.get('url') + '/register', {
				form: {
					email: 'admin@nodebb.org',
					username: 'admin',
					password: 'adminpwd',
				},
				json: true,
				jar: jar,
				headers: {
					'x-csrf-token': body.csrf_token,
				},
			}, function (err, response, body) {
				assert.ifError(err);
				assert(body);

				request({
					url: nconf.get('url') + '/api/me',
					json: true,
					jar: jar,
				}, function (err, response, body) {
					assert.ifError(err);
					assert(body);
					assert.equal(body.username, 'admin');
					assert.equal(body.email, 'admin@nodebb.org');
					done();
				});
			});
		});
	});

	it('should logout a user', function (done) {
		request({
			url: nconf.get('url') + '/api/config',
			json: true,
			jar: jar,
		}, function (err, response, body) {
			assert.ifError(err);

			request.post(nconf.get('url') + '/logout', {
				form: {},
				json: true,
				jar: jar,
				headers: {
					'x-csrf-token': body.csrf_token,
				},
			}, function (err) {
				assert.ifError(err);

				request({
					url: nconf.get('url') + '/api/me',
					json: true,
					jar: jar,
				}, function (err, response, body) {
					assert.ifError(err);
					assert.equal(body, 'not-authorized');
					done();
				});
			});
		});
	});

	it('should login a user', function (done) {
		var jar = request.jar();
		request({
			url: nconf.get('url') + '/api/config',
			json: true,
			jar: jar,
		}, function (err, response, body) {
			assert.ifError(err);

			request.post(nconf.get('url') + '/login', {
				form: {
					username: 'regular',
					password: 'regularpwd',
				},
				json: true,
				jar: jar,
				headers: {
					'x-csrf-token': body.csrf_token,
				},
			}, function (err, response, body) {
				assert.ifError(err);
				assert(body);

				request({
					url: nconf.get('url') + '/api/me',
					json: true,
					jar: jar,
				}, function (err, response, body) {
					assert.ifError(err);
					assert(body);
					assert.equal(body.username, 'regular');
					assert.equal(body.email, 'regular@nodebb.org');
					db.getObject('uid:' + regularUid + ':sessionUUID:sessionId', function (err, sessions) {
						assert.ifError(err);
						assert(sessions);
						assert(Object.keys(sessions).length > 0);
						done();
					});
				});
			});
		});
	});

	it('should revoke all sessions', function (done) {
		var socketAdmin = require('../src/socket.io/admin');
		db.sortedSetCard('uid:' + regularUid + ':sessions', function (err, count) {
			assert.ifError(err);
			assert(count);
			socketAdmin.deleteAllSessions({ uid: 1 }, {}, function (err) {
				assert.ifError(err);
				db.sortedSetCard('uid:' + regularUid + ':sessions', function (err, count) {
					assert.ifError(err);
					assert(!count);
					done();
				});
			});
		});
	});

	it('should fail to login if user does not exist', function (done) {
		var jar = request.jar();
		request({
			url: nconf.get('url') + '/api/config',
			json: true,
			jar: jar,
		}, function (err, response, body) {
			assert.ifError(err);

			request.post(nconf.get('url') + '/login', {
				form: {
					username: 'doesnotexist',
					password: 'nopassword',
				},
				json: true,
				jar: jar,
				headers: {
					'x-csrf-token': body.csrf_token,
				},
			}, function (err, response, body) {
				assert.equal(response.statusCode, 403);
				assert.equal(body, '[[error:invalid-login-credentials]]');
				done();
			});
		});
	});


	after(function (done) {
		db.emptydb(done);
	});
});

