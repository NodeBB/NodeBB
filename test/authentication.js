'use strict';


const assert = require('assert');
const url = require('url');
const async = require('async');
const nconf = require('nconf');
const request = require('request');
const util = require('util');

const db = require('./mocks/databasemock');
const user = require('../src/user');
const utils = require('../src/utils');
const meta = require('../src/meta');
const privileges = require('../src/privileges');
const helpers = require('./helpers');

describe('authentication', () => {
	function loginUser(username, password, callback) {
		const jar = request.jar();
		request({
			url: `${nconf.get('url')}/api/config`,
			json: true,
			jar: jar,
		}, (err, response, body) => {
			if (err) {
				return callback(err);
			}

			request.post(`${nconf.get('url')}/login`, {
				form: {
					username: username,
					password: password,
				},
				json: true,
				jar: jar,
				headers: {
					'x-csrf-token': body.csrf_token,
				},
			}, (err, response, body) => {
				callback(err, response, body, jar);
			});
		});
	}
	const loginUserPromisified = util.promisify(loginUser);

	const jar = request.jar();
	let regularUid;
	before((done) => {
		user.create({ username: 'regular', password: 'regularpwd', email: 'regular@nodebb.org' }, (err, uid) => {
			assert.ifError(err);
			regularUid = uid;
			done();
		});
	});

	it('should fail to create user if username is too short', (done) => {
		helpers.registerUser({
			username: 'a',
			password: '123456',
		}, (err, jar, response, body) => {
			assert.ifError(err);
			assert.equal(response.statusCode, 400);
			assert.equal(body, '[[error:username-too-short]]');
			done();
		});
	});

	it('should fail to create user if userslug is too short', (done) => {
		helpers.registerUser({
			username: '----a-----',
			password: '123456',
		}, (err, jar, response, body) => {
			assert.ifError(err);
			assert.equal(response.statusCode, 400);
			assert.equal(body, '[[error:username-too-short]]');
			done();
		});
	});

	it('should fail to create user if userslug is too short', (done) => {
		helpers.registerUser({
			username: '     a',
			password: '123456',
		}, (err, jar, response, body) => {
			assert.ifError(err);
			assert.equal(response.statusCode, 400);
			assert.equal(body, '[[error:username-too-short]]');
			done();
		});
	});

	it('should fail to create user if userslug is too short', (done) => {
		helpers.registerUser({
			username: 'a      ',
			password: '123456',
		}, (err, jar, response, body) => {
			assert.ifError(err);
			assert.equal(response.statusCode, 400);
			assert.equal(body, '[[error:username-too-short]]');
			done();
		});
	});

	it('should register and login a user', (done) => {
		request({
			url: `${nconf.get('url')}/api/config`,
			json: true,
			jar: jar,
		}, (err, response, body) => {
			assert.ifError(err);

			request.post(`${nconf.get('url')}/register`, {
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
			}, (err, response, body) => {
				assert.ifError(err);
				assert(body);

				request({
					url: `${nconf.get('url')}/api/self`,
					json: true,
					jar: jar,
				}, (err, response, body) => {
					assert.ifError(err);
					assert(body);
					assert.equal(body.username, 'admin');
					assert.equal(body.email, 'admin@nodebb.org');
					user.getSettings(body.uid, (err, settings) => {
						assert.ifError(err);
						assert.equal(settings.userLang, 'it');
						done();
					});
				});
			});
		});
	});

	it('should logout a user', (done) => {
		helpers.logoutUser(jar, (err) => {
			assert.ifError(err);
			request({
				url: `${nconf.get('url')}/api/me`,
				json: true,
				jar: jar,
			}, (err, res, body) => {
				assert.ifError(err);
				assert.equal(res.statusCode, 401);
				assert.strictEqual(body.status.code, 'not-authorised');
				done();
			});
		});
	});

	it('should login a user', (done) => {
		loginUser('regular', 'regularpwd', (err, response, body, jar) => {
			assert.ifError(err);
			assert(body);
			request({
				url: `${nconf.get('url')}/api/self`,
				json: true,
				jar: jar,
			}, (err, response, body) => {
				assert.ifError(err);
				assert(body);
				assert.equal(body.username, 'regular');
				assert.equal(body.email, 'regular@nodebb.org');
				db.getObject(`uid:${regularUid}:sessionUUID:sessionId`, (err, sessions) => {
					assert.ifError(err);
					assert(sessions);
					assert(Object.keys(sessions).length > 0);
					done();
				});
			});
		});
	});

	it('should regenerate the session identifier on successful login', async () => {
		const login = util.promisify(helpers.loginUser);
		const logout = util.promisify(helpers.logoutUser);
		const matchRegexp = /express\.sid=s%3A(.+?);/;
		const { hostname, path } = url.parse(nconf.get('url'));

		const sid = String(jar._jar.store.idx[hostname][path]['express.sid']).match(matchRegexp)[1];
		await logout(jar);
		const newJar = await login('regular', 'regularpwd');
		const newSid = String(newJar._jar.store.idx[hostname][path]['express.sid']).match(matchRegexp)[1];

		assert.notStrictEqual(newSid, sid);
	});

	it('should revoke all sessions', (done) => {
		const socketAdmin = require('../src/socket.io/admin');
		db.sortedSetCard(`uid:${regularUid}:sessions`, (err, count) => {
			assert.ifError(err);
			assert(count);
			socketAdmin.deleteAllSessions({ uid: 1 }, {}, (err) => {
				assert.ifError(err);
				db.sortedSetCard(`uid:${regularUid}:sessions`, (err, count) => {
					assert.ifError(err);
					assert(!count);
					done();
				});
			});
		});
	});

	it('should fail to login if ip address is invalid', (done) => {
		const jar = request.jar();
		request({
			url: `${nconf.get('url')}/api/config`,
			json: true,
			jar: jar,
		}, (err, response, body) => {
			if (err) {
				return done(err);
			}

			request.post(`${nconf.get('url')}/login`, {
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
			}, (err, response, body) => {
				assert.ifError(err);
				assert.equal(response.statusCode, 500);
				done();
			});
		});
	});

	it('should fail to login if user does not exist', (done) => {
		loginUser('doesnotexist', 'nopassword', (err, response, body) => {
			assert.ifError(err);
			assert.equal(response.statusCode, 403);
			assert.equal(body, '[[error:invalid-login-credentials]]');
			done();
		});
	});

	it('should fail to login if username is empty', (done) => {
		loginUser('', 'some password', (err, response, body) => {
			assert.ifError(err);
			assert.equal(response.statusCode, 403);
			assert.equal(body, '[[error:invalid-username-or-password]]');
			done();
		});
	});

	it('should fail to login if password is empty', (done) => {
		loginUser('someuser', '', (err, response, body) => {
			assert.ifError(err);
			assert.equal(response.statusCode, 403);
			assert.equal(body, '[[error:invalid-username-or-password]]');
			done();
		});
	});

	it('should fail to login if username and password are empty', (done) => {
		loginUser('', '', (err, response, body) => {
			assert.ifError(err);
			assert.equal(response.statusCode, 403);
			assert.equal(body, '[[error:invalid-username-or-password]]');
			done();
		});
	});

	it('should fail to login if user does not have password field in db', (done) => {
		user.create({ username: 'hasnopassword', email: 'no@pass.org' }, (err, uid) => {
			assert.ifError(err);
			loginUser('hasnopassword', 'doesntmatter', (err, response, body) => {
				assert.ifError(err);
				assert.equal(response.statusCode, 403);
				assert.equal(body, '[[error:invalid-login-credentials]]');
				done();
			});
		});
	});

	it('should fail to login if password is longer than 4096', (done) => {
		let longPassword;
		for (let i = 0; i < 5000; i++) {
			longPassword += 'a';
		}
		loginUser('someuser', longPassword, (err, response, body) => {
			assert.ifError(err);
			assert.equal(response.statusCode, 403);
			assert.equal(body, '[[error:password-too-long]]');
			done();
		});
	});

	it('should fail to login if local login is disabled', (done) => {
		privileges.global.rescind(['groups:local:login'], 'registered-users', (err) => {
			assert.ifError(err);
			loginUser('regular', 'regularpwd', (err, response, body) => {
				assert.ifError(err);
				assert.equal(response.statusCode, 403);
				assert.equal(body, '[[error:local-login-disabled]]');
				privileges.global.give(['groups:local:login'], 'registered-users', done);
			});
		});
	});

	it('should fail to register if registraton is disabled', (done) => {
		meta.config.registrationType = 'disabled';
		helpers.registerUser({
			username: 'someuser',
			password: 'somepassword',
		}, (err, jar, response, body) => {
			assert.ifError(err);
			assert.equal(response.statusCode, 403);
			assert.equal(body, 'Forbidden');
			done();
		});
	});

	it('should return error if invitation is not valid', (done) => {
		meta.config.registrationType = 'invite-only';
		helpers.registerUser({
			username: 'someuser',
			password: 'somepassword',
		}, (err, jar, response, body) => {
			meta.config.registrationType = 'normal';
			assert.ifError(err);
			assert.equal(response.statusCode, 400);
			assert.equal(body, '[[register:invite.error-invite-only]]');
			done();
		});
	});

	it('should fail to register if username is falsy or too short', (done) => {
		helpers.registerUser({
			username: '',
			password: 'somepassword',
		}, (err, jar, response, body) => {
			assert.ifError(err);
			assert.equal(response.statusCode, 400);
			assert.equal(body, '[[error:username-too-short]]');
			helpers.registerUser({
				username: 'a',
				password: 'somepassword',
			}, (err, jar, response, body) => {
				assert.ifError(err);
				assert.equal(response.statusCode, 400);
				assert.equal(body, '[[error:username-too-short]]');
				done();
			});
		});
	});

	it('should fail to register if username is too long', (done) => {
		helpers.registerUser({
			username: 'thisisareallylongusername',
			password: '123456',
		}, (err, jar, response, body) => {
			assert.ifError(err);
			assert.equal(response.statusCode, 400);
			assert.equal(body, '[[error:username-too-long]]');
			done();
		});
	});

	it('should queue user if ip is used before', (done) => {
		meta.config.registrationApprovalType = 'admin-approval-ip';
		helpers.registerUser({
			email: 'another@user.com',
			username: 'anotheruser',
			password: 'anotherpwd',
			gdpr_consent: 1,
		}, (err, jar, response, body) => {
			meta.config.registrationApprovalType = 'normal';
			assert.ifError(err);
			assert.equal(response.statusCode, 200);
			assert.equal(body.message, '[[register:registration-added-to-queue]]');
			done();
		});
	});


	it('should be able to login with email', async () => {
		const uid = await user.create({ username: 'ginger', password: '123456', email: 'ginger@nodebb.org' });
		await user.email.confirmByUid(uid);
		const response = await loginUserPromisified('ginger@nodebb.org', '123456');
		assert.equal(response.statusCode, 200);
	});

	it('should fail to login if login type is username and an email is sent', (done) => {
		meta.config.allowLoginWith = 'username';
		loginUser('ginger@nodebb.org', '123456', (err, response, body) => {
			meta.config.allowLoginWith = 'username-email';
			assert.ifError(err);
			assert.equal(response.statusCode, 400);
			assert.equal(body, '[[error:wrong-login-type-username]]');
			done();
		});
	});

	it('should send 200 if not logged in', (done) => {
		const jar = request.jar();
		request({
			url: `${nconf.get('url')}/api/config`,
			json: true,
			jar: jar,
		}, (err, response, body) => {
			assert.ifError(err);

			request.post(`${nconf.get('url')}/logout`, {
				form: {},
				json: true,
				jar: jar,
				headers: {
					'x-csrf-token': body.csrf_token,
				},
			}, (err, res, body) => {
				assert.ifError(err);
				assert.equal(res.statusCode, 200);
				assert.equal(body, 'not-logged-in');
				done();
			});
		});
	});

	describe('banned user authentication', () => {
		const bannedUser = {
			username: 'banme',
			pw: '123456',
			uid: null,
		};

		before(async () => {
			bannedUser.uid = await user.create({ username: 'banme', password: '123456', email: 'ban@me.com' });
		});

		it('should prevent banned user from logging in', (done) => {
			user.bans.ban(bannedUser.uid, 0, 'spammer', (err) => {
				assert.ifError(err);
				loginUser(bannedUser.username, bannedUser.pw, (err, res, body) => {
					assert.ifError(err);
					assert.equal(res.statusCode, 403);
					assert.equal(body, '[[error:user-banned-reason, spammer]]');
					user.bans.unban(bannedUser.uid, (err) => {
						assert.ifError(err);
						const expiry = Date.now() + 10000;
						user.bans.ban(bannedUser.uid, expiry, '', (err) => {
							assert.ifError(err);
							loginUser(bannedUser.username, bannedUser.pw, (err, res, body) => {
								assert.ifError(err);
								assert.equal(res.statusCode, 403);
								assert.equal(body, `[[error:user-banned-reason-until, ${utils.toISOString(expiry)}, No reason given.]]`);
								done();
							});
						});
					});
				});
			});
		});

		it('should allow banned user to log in if the "banned-users" group has "local-login" privilege', async () => {
			await privileges.global.give(['groups:local:login'], 'banned-users');
			const res = await loginUserPromisified(bannedUser.username, bannedUser.pw);
			assert.strictEqual(res.statusCode, 200);
		});

		it('should allow banned user to log in if the user herself has "local-login" privilege', async () => {
			await privileges.global.rescind(['groups:local:login'], 'banned-users');
			await privileges.categories.give(['local:login'], 0, bannedUser.uid);
			const res = await loginUserPromisified(bannedUser.username, bannedUser.pw);
			assert.strictEqual(res.statusCode, 200);
		});
	});

	it('should lockout account on 3 failed login attempts', (done) => {
		meta.config.loginAttempts = 3;
		let uid;
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
				db.exists(`lockout:${uid}`, next);
			},
			function (locked, next) {
				assert(locked);
				next();
			},
		], done);
	});

	it('should clear all reset tokens upon successful login', async () => {
		const code = await user.reset.generate(regularUid);
		await loginUserPromisified('regular', 'regularpwd');
		const valid = await user.reset.validate(code);
		assert.strictEqual(valid, false);
	});
});
