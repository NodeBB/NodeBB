'use strict';


const assert = require('assert');
const url = require('url');
const nconf = require('nconf');

const db = require('./mocks/databasemock');
const request = require('../src/request');
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
			hook: 'static:email.send',
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
		plugins.hooks.unregister('authentication-test', 'static:email.send');
	});

	it('should allow login with email for uid 1', async () => {
		const oldValue = meta.config.allowLoginWith;
		meta.config.allowLoginWith = 'username-email';
		const { response } = await helpers.loginUser('regular@nodebb.org', 'regularpwd');
		assert.strictEqual(response.statusCode, 200);
		meta.config.allowLoginWith = oldValue;
	});

	it('second user should fail to login with email since email is not confirmed', async () => {
		const oldValue = meta.config.allowLoginWith;
		meta.config.allowLoginWith = 'username-email';
		const uid = await user.create({ username: '2nduser', password: '2ndpassword', email: '2nduser@nodebb.org' });
		const { response, body } = await helpers.loginUser('2nduser@nodebb.org', '2ndpassword');
		assert.strictEqual(response.statusCode, 400);
		assert.strictEqual(body, '[[error:invalid-email]]');
		meta.config.allowLoginWith = oldValue;
	});

	it('should fail to create user if username is too short', async () => {
		const { response, body } = await helpers.registerUser({
			username: 'a',
			password: '123456',
		});
		assert.equal(response.statusCode, 400);
		assert.equal(body, '[[error:username-too-short]]');
	});

	it('should fail to create user if userslug is too short', async () => {
		const { response, body } = await helpers.registerUser({
			username: '----a-----',
			password: '123456',
		});
		assert.equal(response.statusCode, 400);
		assert.equal(body, '[[error:username-too-short]]');
	});

	it('should fail to create user if userslug is too short', async () => {
		const { response, body } = await helpers.registerUser({
			username: '     a',
			password: '123456',
		});
		assert.equal(response.statusCode, 400);
		assert.equal(body, '[[error:username-too-short]]');
	});

	it('should fail to create user if userslug is too short', async () => {
		const { response, body } = await helpers.registerUser({
			username: 'a      ',
			password: '123456',
		});
		assert.equal(response.statusCode, 400);
		assert.equal(body, '[[error:username-too-short]]');
	});

	it('should register and login a user', async () => {
		const jar = request.jar();
		const csrf_token = await helpers.getCsrfToken(jar);

		const { body } = await request.post(`${nconf.get('url')}/register`, {
			jar,
			body: {
				email: 'admin@nodebb.org',
				username: 'admin',
				password: 'adminpwd',
				'password-confirm': 'adminpwd',
				userLang: 'it',
				gdpr_consent: true,
			},
			headers: {
				'x-csrf-token': csrf_token,
			},
		});

		const validationPending = await user.email.isValidationPending(body.uid, 'admin@nodebb.org');
		assert.strictEqual(validationPending, true);

		assert(body);
		assert(body.hasOwnProperty('uid') && body.uid > 0);
		const newUid = body.uid;
		const { body: self } = await request.get(`${nconf.get('url')}/api/self`, {
			jar,
		});
		assert(self);
		assert.equal(self.username, 'admin');
		assert.equal(self.uid, newUid);
		const settings = await user.getSettings(body.uid);
		assert.equal(settings.userLang, 'it');
	});

	it('should logout a user', async () => {
		await helpers.logoutUser(jar);

		const { response, body } = await request.get(`${nconf.get('url')}/api/me`, {
			jar: jar,
		});
		assert.equal(response.statusCode, 401);
		assert.strictEqual(body.status.code, 'not-authorised');
	});

	it('should regenerate the session identifier on successful login', async () => {
		const matchRegexp = /express\.sid=s%3A(.+?);/;
		const { hostname, path } = url.parse(nconf.get('url'));
		const sid = String(jar.store.idx[hostname][path]['express.sid']).match(matchRegexp)[1];
		await helpers.logoutUser(jar);
		const newJar = (await helpers.loginUser('regular', 'regularpwd')).jar;
		const newSid = String(newJar.store.idx[hostname][path]['express.sid']).match(matchRegexp)[1];

		assert.notStrictEqual(newSid, sid);
	});


	it('should revoke all sessions', async () => {
		const socketAdmin = require('../src/socket.io/admin');
		let sessionCount = await db.sortedSetCard(`uid:${regularUid}:sessions`);
		assert(sessionCount);
		await socketAdmin.deleteAllSessions({ uid: 1 }, {});
		sessionCount = await db.sortedSetCard(`uid:${regularUid}:sessions`);
		assert(!sessionCount);
	});

	describe('login', () => {
		let username;
		let password;
		let uid;

		function getCookieExpiry(response) {
			const { headers } = response;
			assert(headers['set-cookie']);
			assert.strictEqual(headers['set-cookie'].includes('Expires'), true);

			const values = headers['set-cookie'].split(';');
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
			const { body } = await request.get(`${nconf.get('url')}/api/self`, {
				jar,
			});
			assert(body);
			assert.equal(body.username, username);
			const sessions = await db.getSortedSetRange(`uid:${uid}:sessions`, 0, -1);
			assert(sessions);
			assert(Object.keys(sessions).length > 0);
		});

		it('should set a cookie that only lasts for the life of the browser session', async () => {
			const { response } = await helpers.loginUser(username, password);

			assert(response.headers);
			assert(response.headers['set-cookie']);
			assert.strictEqual(response.headers['set-cookie'].includes('Expires'), false);
		});

		it('should set a different expiry if sessionDuration is set', async () => {
			const _sessionDuration = meta.config.sessionDuration;
			const days = 1;
			meta.config.sessionDuration = days * 24 * 60 * 60;

			const { response } = await helpers.loginUser(username, password);

			const expiry = getCookieExpiry(response);
			const expected = new Date();
			expected.setUTCDate(expected.getUTCDate() + days);

			assert.strictEqual(expiry.getUTCDate(), expected.getUTCDate());

			meta.config.sessionDuration = _sessionDuration;
		});

		it('should set a cookie that lasts for x days where x is loginDays setting, if asked to remember', async () => {
			const { response } = await helpers.loginUser(username, password, { remember: 'on' });

			const expiry = getCookieExpiry(response);
			const expected = new Date();
			expected.setUTCDate(expected.getUTCDate() + meta.config.loginDays);

			assert.strictEqual(expiry.getUTCDate(), expected.getUTCDate());
		});

		it('should set the cookie expiry properly if loginDays setting is changed', async () => {
			const _loginDays = meta.config.loginDays;
			meta.config.loginDays = 5;

			const { response } = await helpers.loginUser(username, password, { remember: 'on' });

			const expiry = getCookieExpiry(response);
			const expected = new Date();
			expected.setUTCDate(expected.getUTCDate() + meta.config.loginDays);

			assert.strictEqual(expiry.getUTCDate(), expected.getUTCDate());

			meta.config.loginDays = _loginDays;
		});

		it('should ignore loginDays if loginSeconds is truthy', async () => {
			const _loginSeconds = meta.config.loginSeconds;
			meta.config.loginSeconds = 60;

			const { response } = await helpers.loginUser(username, password, { remember: 'on' });

			const expiry = getCookieExpiry(response);
			const expected = new Date();
			expected.setUTCSeconds(expected.getUTCSeconds() + meta.config.loginSeconds);

			assert.strictEqual(expiry.getUTCDate(), expected.getUTCDate());
			assert.strictEqual(expiry.getUTCMinutes(), expected.getUTCMinutes());

			meta.config.loginSeconds = _loginSeconds;
		});
	});

	it('should fail to login if ip address is invalid', async () => {
		const jar = request.jar();
		const csrf_token = await helpers.getCsrfToken(jar);

		const { response } = await request.post(`${nconf.get('url')}/login`, {
			body: {
				username: 'regular',
				password: 'regularpwd',
			},
			jar: jar,
			headers: {
				'x-csrf-token': csrf_token,
				'x-forwarded-for': '<script>alert("xss")</script>',
			},
		});
		assert.equal(response.status, 500);
	});

	it('should fail to login if user does not exist', async () => {
		const { response, body } = await helpers.loginUser('doesnotexist', 'nopassword');
		assert.equal(response.statusCode, 403);
		assert.equal(body, '[[error:invalid-login-credentials]]');
	});

	it('should fail to login if username is empty', async () => {
		const { response, body } = await helpers.loginUser('', 'some password');
		assert.equal(response.statusCode, 403);
		assert.equal(body, '[[error:invalid-username-or-password]]');
	});

	it('should fail to login if password is empty', async () => {
		const { response, body } = await helpers.loginUser('someuser', '');
		assert.equal(response.statusCode, 403);
		assert.equal(body, '[[error:invalid-username-or-password]]');
	});

	it('should fail to login if username and password are empty', async () => {
		const { response, body } = await helpers.loginUser('', '');
		assert.equal(response.statusCode, 403);
		assert.equal(body, '[[error:invalid-username-or-password]]');
	});

	it('should fail to login if user does not have password field in db', async () => {
		await user.create({ username: 'hasnopassword', email: 'no@pass.org' });
		const { response, body } = await helpers.loginUser('hasnopassword', 'doesntmatter');
		assert.equal(response.statusCode, 403);
		assert.equal(body, '[[error:invalid-login-credentials]]');
	});

	it('should fail to login if password is longer than 4096', async () => {
		let longPassword = '';
		for (let i = 0; i < 5000; i++) {
			longPassword += 'a';
		}
		const { response, body } = await helpers.loginUser('someuser', longPassword);
		assert.equal(response.statusCode, 403);
		assert.equal(body, '[[error:password-too-long]]');
	});

	it('should fail to login if local login is disabled', async () => {
		await privileges.global.rescind(['groups:local:login'], 'registered-users');
		const { response, body } = await helpers.loginUser('regular', 'regularpwd');
		assert.equal(response.statusCode, 403);
		assert.equal(body, '[[error:local-login-disabled]]');
		await privileges.global.give(['groups:local:login'], 'registered-users');
	});

	it('should fail to register if registraton is disabled', async () => {
		meta.config.registrationType = 'disabled';
		const { response, body } = await helpers.registerUser({
			username: 'someuser',
			password: 'somepassword',
		});
		assert.equal(response.statusCode, 403);
		assert.equal(body, 'Forbidden');
	});

	it('should return error if invitation is not valid', async () => {
		meta.config.registrationType = 'invite-only';
		const { response, body } = await helpers.registerUser({
			username: 'someuser',
			password: 'somepassword',
		});
		meta.config.registrationType = 'normal';
		assert.equal(response.statusCode, 400);
		assert.equal(body, '[[register:invite.error-invite-only]]');
	});

	it('should fail to register if username is falsy or too short', async () => {
		const userData = [
			{ username: '', password: 'somepassword' },
			{ username: 'a', password: 'somepassword' },
		];
		for (const user of userData) {
			// eslint-disable-next-line no-await-in-loop
			const { response, body } = await helpers.registerUser(user);
			assert.equal(response.statusCode, 400);
			assert.equal(body, '[[error:username-too-short]]');
		}
	});

	it('should fail to register if username is too long', async () => {
		const { response, body } = await helpers.registerUser({
			username: 'thisisareallylongusername',
			password: '123456',
		});

		assert.equal(response.statusCode, 400);
		assert.equal(body, '[[error:username-too-long]]');
	});

	it('should queue user if ip is used before', async () => {
		meta.config.registrationApprovalType = 'admin-approval-ip';
		const { response, body } = await helpers.registerUser({
			email: 'another@user.com',
			username: 'anotheruser',
			password: 'anotherpwd',
			gdpr_consent: 1,
		});
		meta.config.registrationApprovalType = 'normal';
		assert.equal(response.statusCode, 200);
		assert.equal(body.message, '[[register:registration-added-to-queue]]');
	});


	it('should be able to login with email', async () => {
		const email = 'ginger@nodebb.org';
		const uid = await user.create({ username: 'ginger', password: '123456', email });
		await user.setUserField(uid, 'email', email);
		await user.email.confirmByUid(uid);
		const { response } = await helpers.loginUser('ginger@nodebb.org', '123456');
		assert.equal(response.statusCode, 200);
	});

	it('should fail to login if login type is username and an email is sent', async () => {
		meta.config.allowLoginWith = 'username';
		const { response, body } = await helpers.loginUser('ginger@nodebb.org', '123456');
		meta.config.allowLoginWith = 'username-email';
		assert.equal(response.statusCode, 400);
		assert.equal(body, '[[error:wrong-login-type-username]]');
	});

	it('should send 200 if not logged in', async () => {
		const jar = request.jar();
		const csrf_token = await helpers.getCsrfToken(jar);

		const { response, body } = await request.post(`${nconf.get('url')}/logout`, {
			data: {},
			jar: jar,
			headers: {
				'x-csrf-token': csrf_token,
			},
		});

		assert.equal(response.statusCode, 200);
		assert.equal(body, 'not-logged-in');
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
			const { response: res1, body: body1 } = await helpers.loginUser(bannedUser.username, bannedUser.pw);
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
			const { response: res2, body: body2 } = await helpers.loginUser(bannedUser.username, bannedUser.pw);
			assert.equal(res2.statusCode, 403);
			assert(body2.banned_until);
			assert(body2.reason, '[[user:info.banned-no-reason]]');
		});

		it('should allow banned user to log in if the "banned-users" group has "local-login" privilege', async () => {
			await privileges.global.give(['groups:local:login'], 'banned-users');
			const { response } = await helpers.loginUser(bannedUser.username, bannedUser.pw);
			assert.strictEqual(response.statusCode, 200);
		});

		it('should allow banned user to log in if the user herself has "local-login" privilege', async () => {
			await privileges.global.rescind(['groups:local:login'], 'banned-users');
			await privileges.categories.give(['local:login'], 0, bannedUser.uid);
			const { response } = await helpers.loginUser(bannedUser.username, bannedUser.pw);
			assert.strictEqual(response.statusCode, 200);
		});
	});

	it('should lockout account on 3 failed login attempts', async () => {
		meta.config.loginAttempts = 3;
		const uid = await user.create({ username: 'lockme', password: '123456' });
		await helpers.loginUser('lockme', 'abcdef');
		await helpers.loginUser('lockme', 'abcdef');
		await helpers.loginUser('lockme', 'abcdef');
		let data = await helpers.loginUser('lockme', 'abcdef');

		meta.config.loginAttempts = 5;
		assert.equal(data.response.statusCode, 403);
		assert.equal(data.body, '[[error:account-locked]]');
		data = await helpers.loginUser('lockme', 'abcdef');
		assert.equal(data.response.statusCode, 403);
		assert.equal(data.body, '[[error:account-locked]]');
		const locked = await db.exists(`lockout:${uid}`);
		assert(locked);
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
			const { response, body } = await helpers.request('get', `/api/self?_uid${newUid}`, {
				jar: jar,
				headers: {
					Authorization: `Bearer sdfhaskfdja-jahfdaksdf`,
				},
			});
			assert.strictEqual(response.statusCode, 401);
			assert.strictEqual(body, 'not-authorized');
		});

		it('should use a token tied to an uid', async () => {
			const { response, body } = await helpers.request('get', `/api/self`, {
				headers: {
					Authorization: `Bearer ${userToken}`,
				},
			});

			assert.strictEqual(response.statusCode, 200);
			assert.strictEqual(body.username, 'apiUserTarget');
		});

		it('should fail if _uid is not passed in with master token', async () => {
			const { response, body } = await helpers.request('get', `/api/self`, {
				headers: {
					Authorization: `Bearer ${masterToken}`,
				},
			});

			assert.strictEqual(response.statusCode, 500);
			assert.strictEqual(body.error, '[[error:api.master-token-no-uid]]');
		});

		it('should use master api token and _uid', async () => {
			const { response, body } = await helpers.request('get', `/api/self?_uid=${newUid}`, {
				headers: {
					Authorization: `Bearer ${masterToken}`,
				},
			});

			assert.strictEqual(response.statusCode, 200);
			assert.strictEqual(body.username, 'apiUserTarget');
		});
	});
});
