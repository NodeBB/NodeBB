'use strict';


const assert = require('assert');
const url = require('url');
const async = require('async');
const nconf = require('nconf');
const request = require('request');
const requestAsync = require('request-promise-native');
const util = require('util');

const db = require('./mocks/databasemock');
const user = require('../src/user');
const utils = require('../src/utils');
const meta = require('../src/meta');
const plugins = require('../src/plugins');
const privileges = require('../src/privileges');
const api = require('../src/api');
const helpers = require('./helpers');

describe('authentication', () => {
	const jar = request.jar();
	let regularUid;
	const dummyEmailerHook = async (data) => {};

	before((done) => {
		// Attach an emailer hook so related requests do not error
		plugins.hooks.register('authentication-test', {
			hook: 'filter:email.send',
			method: dummyEmailerHook,
		});

		user.create({ username: 'regular', password: 'regularpwd', email: 'regular@nodebb.org' }, (err, uid) => {
			assert.ifError(err);
			regularUid = uid;
			assert.strictEqual(uid, 1);
			done();
		});
	});

	after(() => {
		plugins.hooks.unregister('authentication-test', 'filter:email.send');
	});

	it('should allow login with email for uid 1', async () => {
		const oldValue = meta.config.allowLoginWith;
		meta.config.allowLoginWith = 'username-email';
		const { res } = await helpers.loginUser('regular@nodebb.org', 'regularpwd');
		assert.strictEqual(res.statusCode, 200);
		meta.config.allowLoginWith = oldValue;
	});

	it('second user should fail to login with email since email is not confirmed', async () => {
		const oldValue = meta.config.allowLoginWith;
		meta.config.allowLoginWith = 'username-email';
		const uid = await user.create({ username: '2nduser', password: '2ndpassword', email: '2nduser@nodebb.org' });
		const { res, body } = await helpers.loginUser('2nduser@nodebb.org', '2ndpassword');
		assert.strictEqual(res.statusCode, 403);
		assert.strictEqual(body, '[[error:invalid-login-credentials]]');
		meta.config.allowLoginWith = oldValue;
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
			}, async (err, response, body) => {
				const validationPending = await user.email.isValidationPending(body.uid, 'admin@nodebb.org');
				assert.strictEqual(validationPending, true);
				assert.ifError(err);
				assert(body);
				assert(body.hasOwnProperty('uid') && body.uid > 0);
				const newUid = body.uid;
				request({
					url: `${nconf.get('url')}/api/self`,
					json: true,
					jar: jar,
				}, (err, response, body) => {
					assert.ifError(err);
					assert(body);
					assert.equal(body.username, 'admin');
					assert.equal(body.uid, newUid);
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

	it('should regenerate the session identifier on successful login', async () => {
		const matchRegexp = /express\.sid=s%3A(.+?);/;
		const { hostname, path } = url.parse(nconf.get('url'));

		const sid = String(jar._jar.store.idx[hostname][path]['express.sid']).match(matchRegexp)[1];
		await helpers.logoutUser(jar);
		const newJar = (await helpers.loginUser('regular', 'regularpwd')).jar;
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

	describe('login', () => {
		let username;
		let password;
		let uid;

		function getCookieExpiry(res) {
			assert(res.headers['set-cookie']);
			assert.strictEqual(res.headers['set-cookie'][0].includes('Expires'), true);

			const values = res.headers['set-cookie'][0].split(';');
			return values.reduce((memo, cur) => {
				if (!memo) {
					const [name, value] = cur.split('=');
					if (name === ' Expires') {
						memo = new Date(value);
					}
				}

				return memo;
			}, undefined);
		}

		beforeEach(async () => {
			([username, password] = [utils.generateUUID().slice(0, 10), utils.generateUUID()]);
			uid = await user.create({ username, password });
		});

		it('should login a user', async () => {
			const { jar, body: loginBody } = await helpers.loginUser(username, password);
			assert(loginBody);
			const body = await requestAsync({
				url: `${nconf.get('url')}/api/self`,
				json: true,
				jar,
			});
			assert(body);
			assert.equal(body.username, username);
			const sessions = await db.getObject(`uid:${uid}:sessionUUID:sessionId`);
			assert(sessions);
			assert(Object.keys(sessions).length > 0);
		});

		it('should set a cookie that only lasts for the life of the browser session', async () => {
			const { res } = await helpers.loginUser(username, password);

			assert(res.headers);
			assert(res.headers['set-cookie']);
			assert.strictEqual(res.headers['set-cookie'][0].includes('Expires'), false);
		});

		it('should set a different expiry if sessionDuration is set', async () => {
			const _sessionDuration = meta.config.sessionDuration;
			const days = 1;
			meta.config.sessionDuration = days * 24 * 60 * 60;

			const { res } = await helpers.loginUser(username, password);

			const expiry = getCookieExpiry(res);
			const expected = new Date();
			expected.setUTCDate(expected.getUTCDate() + days);

			assert.strictEqual(expiry.getUTCDate(), expected.getUTCDate());

			meta.config.sessionDuration = _sessionDuration;
		});

		it('should set a cookie that lasts for x days where x is loginDays setting, if asked to remember', async () => {
			const { res } = await helpers.loginUser(username, password, { remember: 'on' });

			const expiry = getCookieExpiry(res);
			const expected = new Date();
			expected.setUTCDate(expected.getUTCDate() + meta.config.loginDays);

			assert.strictEqual(expiry.getUTCDate(), expected.getUTCDate());
		});

		it('should set the cookie expiry properly if loginDays setting is changed', async () => {
			const _loginDays = meta.config.loginDays;
			meta.config.loginDays = 5;

			const { res } = await helpers.loginUser(username, password, { remember: 'on' });

			const expiry = getCookieExpiry(res);
			const expected = new Date();
			expected.setUTCDate(expected.getUTCDate() + meta.config.loginDays);

			assert.strictEqual(expiry.getUTCDate(), expected.getUTCDate());

			meta.config.loginDays = _loginDays;
		});

		it('should ignore loginDays if loginSeconds is truthy', async () => {
			const _loginSeconds = meta.config.loginSeconds;
			meta.config.loginSeconds = 60;

			const { res } = await helpers.loginUser(username, password, { remember: 'on' });

			const expiry = getCookieExpiry(res);
			const expected = new Date();
			expected.setUTCSeconds(expected.getUTCSeconds() + meta.config.loginSeconds);

			assert.strictEqual(expiry.getUTCDate(), expected.getUTCDate());
			assert.strictEqual(expiry.getUTCMinutes(), expected.getUTCMinutes());

			meta.config.loginSeconds = _loginSeconds;
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

	it('should fail to login if user does not exist', async () => {
		const { res, body } = await helpers.loginUser('doesnotexist', 'nopassword');
		assert.equal(res.statusCode, 403);
		assert.equal(body, '[[error:invalid-login-credentials]]');
	});

	it('should fail to login if username is empty', async () => {
		const { res, body } = await helpers.loginUser('', 'some password');
		assert.equal(res.statusCode, 403);
		assert.equal(body, '[[error:invalid-username-or-password]]');
	});

	it('should fail to login if password is empty', async () => {
		const { res, body } = await helpers.loginUser('someuser', '');
		assert.equal(res.statusCode, 403);
		assert.equal(body, '[[error:invalid-username-or-password]]');
	});

	it('should fail to login if username and password are empty', async () => {
		const { res, body } = await helpers.loginUser('', '');
		assert.equal(res.statusCode, 403);
		assert.equal(body, '[[error:invalid-username-or-password]]');
	});

	it('should fail to login if user does not have password field in db', async () => {
		await user.create({ username: 'hasnopassword', email: 'no@pass.org' });
		const { res, body } = await helpers.loginUser('hasnopassword', 'doesntmatter');
		assert.equal(res.statusCode, 403);
		assert.equal(body, '[[error:invalid-login-credentials]]');
	});

	it('should fail to login if password is longer than 4096', async () => {
		let longPassword;
		for (let i = 0; i < 5000; i++) {
			longPassword += 'a';
		}
		const { res, body } = await helpers.loginUser('someuser', longPassword);
		assert.equal(res.statusCode, 403);
		assert.equal(body, '[[error:password-too-long]]');
	});

	it('should fail to login if local login is disabled', async () => {
		await privileges.global.rescind(['groups:local:login'], 'registered-users');
		const { res, body } = await helpers.loginUser('regular', 'regularpwd');
		assert.equal(res.statusCode, 403);
		assert.equal(body, '[[error:local-login-disabled]]');
		await privileges.global.give(['groups:local:login'], 'registered-users');
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
		const email = 'ginger@nodebb.org';
		const uid = await user.create({ username: 'ginger', password: '123456', email });
		await user.setUserField(uid, 'email', email);
		await user.email.confirmByUid(uid);
		const { res } = await helpers.loginUser('ginger@nodebb.org', '123456');
		assert.equal(res.statusCode, 200);
	});

	it('should fail to login if login type is username and an email is sent', async () => {
		meta.config.allowLoginWith = 'username';
		const { res, body } = await helpers.loginUser('ginger@nodebb.org', '123456');
		meta.config.allowLoginWith = 'username-email';
		assert.equal(res.statusCode, 400);
		assert.equal(body, '[[error:wrong-login-type-username]]');
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

		it('should prevent banned user from logging in', async () => {
			await user.bans.ban(bannedUser.uid, 0, 'spammer');
			const { res: res1, body: body1 } = await helpers.loginUser(bannedUser.username, bannedUser.pw);
			assert.equal(res1.statusCode, 403);
			delete body1.timestamp;
			assert.deepStrictEqual(body1, {
				banned_until: 0,
				banned_until_readable: '',
				expiry: 0,
				expiry_readable: '',
				reason: 'spammer',
				uid: bannedUser.uid,
			});
			await user.bans.unban(bannedUser.uid);
			const expiry = Date.now() + 10000;
			await user.bans.ban(bannedUser.uid, expiry, '');
			const { res: res2, body: body2 } = await helpers.loginUser(bannedUser.username, bannedUser.pw);
			assert.equal(res2.statusCode, 403);
			assert(body2.banned_until);
			assert(body2.reason, '[[user:info.banned-no-reason]]');
		});

		it('should allow banned user to log in if the "banned-users" group has "local-login" privilege', async () => {
			await privileges.global.give(['groups:local:login'], 'banned-users');
			const { res } = await helpers.loginUser(bannedUser.username, bannedUser.pw);
			assert.strictEqual(res.statusCode, 200);
		});

		it('should allow banned user to log in if the user herself has "local-login" privilege', async () => {
			await privileges.global.rescind(['groups:local:login'], 'banned-users');
			await privileges.categories.give(['local:login'], 0, bannedUser.uid);
			const { res } = await helpers.loginUser(bannedUser.username, bannedUser.pw);
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
			async (_uid) => {
				uid = _uid;
				return helpers.loginUser('lockme', 'abcdef');
			},
			async data => helpers.loginUser('lockme', 'abcdef'),
			async data => helpers.loginUser('lockme', 'abcdef'),
			async data => helpers.loginUser('lockme', 'abcdef'),
			async (data) => {
				meta.config.loginAttempts = 5;
				assert.equal(data.res.statusCode, 403);
				assert.equal(data.body, '[[error:account-locked]]');
				return helpers.loginUser('lockme', 'abcdef');
			},
			function (data, next) {
				assert.equal(data.res.statusCode, 403);
				assert.equal(data.body, '[[error:account-locked]]');
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
		await helpers.loginUser('regular', 'regularpwd');
		const valid = await user.reset.validate(code);
		assert.strictEqual(valid, false);
	});

	describe('api tokens', () => {
		let newUid;
		let userToken;
		let masterToken;
		before(async () => {
			newUid = await user.create({ username: 'apiUserTarget' });
			userToken = await api.utils.tokens.generate({
				uid: newUid,
				description: `api token for uid ${newUid}`,
			});
			masterToken = await api.utils.tokens.generate({
				uid: 0,
				description: 'api master token',
			});
		});

		it('should fail with invalid token', async () => {
			const { res, body } = await helpers.request('get', `/api/self`, {
				form: {
					_uid: newUid,
				},
				json: true,
				jar: jar,
				headers: {
					Authorization: `Bearer sdfhaskfdja-jahfdaksdf`,
				},
			});
			assert.strictEqual(res.statusCode, 401);
			assert.strictEqual(body, 'not-authorized');
		});

		it('should use a token tied to an uid', async () => {
			const { res, body } = await helpers.request('get', `/api/self`, {
				json: true,
				headers: {
					Authorization: `Bearer ${userToken}`,
				},
			});

			assert.strictEqual(res.statusCode, 200);
			assert.strictEqual(body.username, 'apiUserTarget');
		});

		it('should fail if _uid is not passed in with master token', async () => {
			const { res, body } = await helpers.request('get', `/api/self`, {
				form: {},
				json: true,
				headers: {
					Authorization: `Bearer ${masterToken}`,
				},
			});

			assert.strictEqual(res.statusCode, 500);
			assert.strictEqual(body.error, '[[error:api.master-token-no-uid]]');
		});

		it('should use master api token and _uid', async () => {
			const { res, body } = await helpers.request('get', `/api/self`, {
				form: {
					_uid: newUid,
				},
				json: true,
				headers: {
					Authorization: `Bearer ${masterToken}`,
				},
			});

			assert.strictEqual(res.statusCode, 200);
			assert.strictEqual(body.username, 'apiUserTarget');
		});
	});
});
