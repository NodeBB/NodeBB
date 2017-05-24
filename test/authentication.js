'use strict';


var	assert = require('assert');
var nconf = require('nconf');
var request = require('request');

var db = require('./mocks/databasemock');
var user = require('../src/user');
var meta = require('../src/meta');

describe('authentication', function () {
	function loginUser(username, password, callback) {
		var jar = request.jar();
		request({
			url: nconf.get('url') + '/api/config',
			json: true,
			jar: jar,
		}, function (err, response, body) {
			if (err) {
				return callback(err);
			}

			request.post(nconf.get('url') + '/login', {
				form: {
					username: username,
					password: password,
				},
				json: true,
				jar: jar,
				headers: {
					'x-csrf-token': body.csrf_token,
				},
			}, function (err, response, body) {
				callback(err, response, body, jar);
			});
		});
	}

	function registerUser(email, username, password, callback) {
		var jar = request.jar();
		request({
			url: nconf.get('url') + '/api/config',
			json: true,
			jar: jar,
		}, function (err, response, body) {
			if (err) {
				return callback(err);
			}

			request.post(nconf.get('url') + '/register', {
				form: {
					email: email,
					username: username,
					password: password,
				},
				json: true,
				jar: jar,
				headers: {
					'x-csrf-token': body.csrf_token,
				},
			}, function (err, response, body) {
				callback(err, response, body, jar);
			});
		});
	}

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
		loginUser('regular', 'regularpwd', function (err, response, body, jar) {
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
		loginUser('doesnotexist', 'nopassword', function (err, response, body) {
			assert.ifError(err);
			assert.equal(response.statusCode, 403);
			assert.equal(body, '[[error:invalid-login-credentials]]');
			done();
		});
	});

	it('should fail to login if username is empty', function (done) {
		loginUser('', 'some password', function (err, response, body) {
			assert.ifError(err);
			assert.equal(response.statusCode, 403);
			assert.equal(body, '[[error:invalid-username-or-password]]');
			done();
		});
	});

	it('should fail to login if password is empty', function (done) {
		loginUser('someuser', '', function (err, response, body) {
			assert.ifError(err);
			assert.equal(response.statusCode, 403);
			assert.equal(body, '[[error:invalid-username-or-password]]');
			done();
		});
	});

	it('should fail to login if username and password are empty', function (done) {
		loginUser('', '', function (err, response, body) {
			assert.ifError(err);
			assert.equal(response.statusCode, 403);
			assert.equal(body, '[[error:invalid-username-or-password]]');
			done();
		});
	});

	it('should fail to login if password is longer than 4096', function (done) {
		var longPassword;
		for (var i = 0; i < 5000; i++) {
			longPassword += 'a';
		}
		loginUser('someuser', longPassword, function (err, response, body) {
			assert.ifError(err);
			assert.equal(response.statusCode, 403);
			assert.equal(body, '[[error:password-too-long]]');
			done();
		});
	});


	it('should fail to login if local login is disabled', function (done) {
		meta.config.allowLocalLogin = 0;
		loginUser('someuser', 'somepass', function (err, response, body) {
			meta.config.allowLocalLogin = 1;
			assert.ifError(err);
			assert.equal(response.statusCode, 403);
			assert.equal(body, '[[error:local-login-disabled]]');
			done();
		});
	});

	it('should fail to register if registraton is disabled', function (done) {
		meta.config.registrationType = 'disabled';
		registerUser('some@user.com', 'someuser', 'somepassword', function (err, response, body) {
			assert.ifError(err);
			assert.equal(response.statusCode, 403);
			assert.equal(body, 'Forbidden');
			done();
		});
	});

	it('should return error if invitation is not valid', function (done) {
		meta.config.registrationType = 'invite-only';
		registerUser('some@user.com', 'someuser', 'somepassword', function (err, response, body) {
			meta.config.registrationType = 'normal';
			assert.ifError(err);
			assert.equal(response.statusCode, 400);
			assert.equal(body, '[[error:invalid-data]]');
			done();
		});
	});

	it('should fail to register if email is falsy', function (done) {
		registerUser('', 'someuser', 'somepassword', function (err, response, body) {
			assert.ifError(err);
			assert.equal(response.statusCode, 400);
			assert.equal(body, '[[error:invalid-email]]');
			done();
		});
	});

	it('should fail to register if username is falsy or too short', function (done) {
		registerUser('some@user.com', '', 'somepassword', function (err, response, body) {
			assert.ifError(err);
			assert.equal(response.statusCode, 400);
			assert.equal(body, '[[error:username-too-short]]');
			registerUser('some@user.com', 'a', 'somepassword', function (err, response, body) {
				assert.ifError(err);
				assert.equal(response.statusCode, 400);
				assert.equal(body, '[[error:username-too-short]]');
				done();
			});
		});
	});

	it('should fail to register if username is too long', function (done) {
		registerUser('some@user.com', 'thisisareallylongusername', '123456', function (err, response, body) {
			assert.ifError(err);
			assert.equal(response.statusCode, 400);
			assert.equal(body, '[[error:username-too-long]]');
			done();
		});
	});

	after(function (done) {
		db.emptydb(done);
	});
});

