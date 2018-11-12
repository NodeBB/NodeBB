'use strict';


var assert = require('assert');
var nconf = require('nconf');
var request = require('request');
var async = require('async');

var db = require('./mocks/databasemock');
var user = require('../src/user');
var meta = require('../src/meta');
var privileges = require('../src/privileges');
var helpers = require('./helpers');

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
					'password-confirm': password,
					gdpr_consent: true,
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

	it('should fail to create user if username is too short', function (done) {
		helpers.registerUser({
			username: 'a',
			password: '123456',
			'password-confirm': '123456',
			email: 'should@error1.com',
		}, function (err, jar, response, body) {
			assert.ifError(err);
			assert.equal(response.statusCode, 400);
			assert.equal(body, '[[error:username-too-short]]');
			done();
		});
	});

	it('should fail to create user if userslug is too short', function (done) {
		helpers.registerUser({
			username: '----a-----',
			password: '123456',
			'password-confirm': '123456',
			email: 'should@error2.com',
		}, function (err, jar, response, body) {
			assert.ifError(err);
			assert.equal(response.statusCode, 400);
			assert.equal(body, '[[error:username-too-short]]');
			done();
		});
	});

	it('should fail to create user if userslug is too short', function (done) {
		helpers.registerUser({
			username: '     a',
			password: '123456',
			'password-confirm': '123456',
			email: 'should@error3.com',
		}, function (err, jar, response, body) {
			assert.ifError(err);
			assert.equal(response.statusCode, 400);
			assert.equal(body, '[[error:username-too-short]]');
			done();
		});
	});

	it('should fail to create user if userslug is too short', function (done) {
		helpers.registerUser({
			username: 'a      ',
			password: '123456',
			'password-confirm': '123456',
			email: 'should@error4.com',
		}, function (err, jar, response, body) {
			assert.ifError(err);
			assert.equal(response.statusCode, 400);
			assert.equal(body, '[[error:username-too-short]]');
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
					'password-confirm': 'adminpwd',
					userLang: 'it',
					gdpr_consent: true,
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
					user.getSettings(body.uid, function (err, settings) {
						assert.ifError(err);
						assert.equal(settings.userLang, 'it');
						done();
					});
				});
			});
		});
	});

	it('should logout a user', function (done) {
		helpers.logoutUser(jar, function (err) {
			assert.ifError(err);
			request({
				url: nconf.get('url') + '/api/me',
				json: true,
				jar: jar,
			}, function (err, res, body) {
				assert.ifError(err);
				assert.equal(res.statusCode, 401);
				assert.equal(body, 'not-authorized');
				done();
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

	it('should fail to login if ip address if invalid', function (done) {
		var jar = request.jar();
		request({
			url: nconf.get('url') + '/api/config',
			json: true,
			jar: jar,
		}, function (err, response, body) {
			if (err) {
				return done(err);
			}

			request.post(nconf.get('url') + '/login', {
				form: {
					username: 'regular',
					password: 'regularpwd',
				},
				json: true,
				jar: jar,
				headers: {
					'x-csrf-token': body.csrf_token,
					'x-forwarded-for': '<script>alert("xss")</script>',
				},
			}, function (err, response, body) {
				assert.ifError(err);
				assert.equal(response.statusCode, 500);
				done();
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

	it('should fail to login if user does not have password field in db', function (done) {
		user.create({ username: 'hasnopassword', email: 'no@pass.org' }, function (err, uid) {
			assert.ifError(err);
			loginUser('hasnopassword', 'doesntmatter', function (err, response, body) {
				assert.ifError(err);
				assert.equal(response.statusCode, 403);
				assert.equal(body, '[[error:invalid-login-credentials]]');
				done();
			});
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
		privileges.global.rescind(['local:login'], 'registered-users', function (err) {
			assert.ifError(err);
			loginUser('regular', 'regularpwd', function (err, response, body) {
				assert.ifError(err);
				assert.equal(response.statusCode, 403);
				assert.equal(body, '[[error:local-login-disabled]]');
				privileges.global.give(['local:login'], 'registered-users', done);
			});
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

	it('should queue user if ip is used before', function (done) {
		meta.config.registrationType = 'admin-approval-ip';
		registerUser('another@user.com', 'anotheruser', 'anotherpwd', function (err, response, body) {
			meta.config.registrationType = 'normal';
			assert.ifError(err);
			assert.equal(response.statusCode, 200);
			assert.equal(body.message, '[[register:registration-added-to-queue]]');
			done();
		});
	});


	it('should be able to login with email', function (done) {
		user.create({ username: 'ginger', password: '123456', email: 'ginger@nodebb.org' }, function (err) {
			assert.ifError(err);
			loginUser('ginger@nodebb.org', '123456', function (err, response) {
				assert.ifError(err);
				assert.equal(response.statusCode, 200);
				done();
			});
		});
	});

	it('should fail to login if login type is username and an email is sent', function (done) {
		meta.config.allowLoginWith = 'username';
		loginUser('ginger@nodebb.org', '123456', function (err, response, body) {
			meta.config.allowLoginWith = 'username-email';
			assert.ifError(err);
			assert.equal(response.statusCode, 500);
			assert.equal(body, '[[error:wrong-login-type-username]]');
			done();
		});
	});

	it('should send 200 if not logged in', function (done) {
		var jar = request.jar();
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
			}, function (err, res, body) {
				assert.ifError(err);
				assert.equal(res.statusCode, 200);
				assert.equal(body, 'not-logged-in');
				done();
			});
		});
	});

	it('should prevent banned user from logging in', function (done) {
		user.create({ username: 'banme', password: '123456', email: 'ban@me.com' }, function (err, uid) {
			assert.ifError(err);
			user.ban(uid, 0, 'spammer', function (err) {
				assert.ifError(err);
				loginUser('banme', '123456', function (err, res, body) {
					assert.ifError(err);
					assert.equal(res.statusCode, 403);
					assert.equal(body, '[[error:user-banned-reason, spammer]]');
					user.unban(uid, function (err) {
						assert.ifError(err);
						var expiry = Date.now() + 10000;
						user.ban(uid, expiry, '', function (err) {
							assert.ifError(err);
							loginUser('banme', '123456', function (err, res, body) {
								assert.ifError(err);
								assert.equal(res.statusCode, 403);
								assert.equal(body, '[[error:user-banned-reason-until, ' + (new Date(parseInt(expiry, 10)).toString()) + ', No reason given.]]');
								done();
							});
						});
					});
				});
			});
		});
	});

	it('should lockout account on 3 failed login attempts', function (done) {
		meta.config.loginAttempts = 3;
		var uid;
		async.waterfall([
			function (next) {
				user.create({ username: 'lockme', password: '123456' }, next);
			},
			function (_uid, next) {
				uid = _uid;
				loginUser('lockme', 'abcdef', next);
			},
			function (res, body, jar, next) {
				loginUser('lockme', 'abcdef', next);
			},
			function (res, body, jar, next) {
				loginUser('lockme', 'abcdef', next);
			},
			function (res, body, jar, next) {
				loginUser('lockme', 'abcdef', next);
			},
			function (res, body, jar, next) {
				meta.config.loginAttempts = 5;
				assert.equal(res.statusCode, 403);
				assert.equal(body, '[[error:account-locked]]');
				loginUser('lockme', 'abcdef', next);
			},
			function (res, body, jar, next) {
				assert.equal(res.statusCode, 403);
				assert.equal(body, '[[error:account-locked]]');
				db.exists('lockout:' + uid, next);
			},
			function (locked, next) {
				assert(locked);
				next();
			},
		], done);
	});
});
