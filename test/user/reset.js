'use strict';

const assert = require('assert');
const async = require('async');

const db = require('../mocks/databasemock');

const user = require('../../src/user');
const groups = require('../../src/groups');
const password = require('../../src/password');
const utils = require('../../src/utils');

const socketUser = require('../../src/socket.io/user');

describe('Password reset (library methods)', () => {
	let uid;
	let code;
	before(async () => {
		uid = await user.create({ username: 'resetuser', password: '123456' });
		await user.setUserField(uid, 'email', 'reset@me.com');
		await user.email.confirmByUid(uid);
	});

	it('.generate() should generate a new reset code', (done) => {
		user.reset.generate(uid, (err, _code) => {
			assert.ifError(err);
			assert(_code);

			code = _code;
			done();
		});
	});

	it('.generate() should invalidate a previous generated reset code', async () => {
		const _code = await user.reset.generate(uid);
		const valid = await user.reset.validate(code);
		assert.strictEqual(valid, false);

		code = _code;
	});

	it('.validate() should ensure that this new code is valid', (done) => {
		user.reset.validate(code, (err, valid) => {
			assert.ifError(err);
			assert.strictEqual(valid, true);
			done();
		});
	});

	it('.validate() should correctly identify an invalid code', (done) => {
		user.reset.validate(`${code}abcdef`, (err, valid) => {
			assert.ifError(err);
			assert.strictEqual(valid, false);
			done();
		});
	});

	it('.send() should create a new reset code and reset password', async () => {
		code = await user.reset.send('reset@me.com');
	});

	it('.commit() should update the user\'s password and confirm their email', (done) => {
		user.reset.commit(code, 'newpassword', (err) => {
			assert.ifError(err);

			async.parallel({
				userData: function (next) {
					user.getUserData(uid, next);
				},
				password: function (next) {
					db.getObjectField(`user:${uid}`, 'password', next);
				},
			}, (err, results) => {
				assert.ifError(err);
				password.compare('newpassword', results.password, true, (err, match) => {
					assert.ifError(err);
					assert(match);
					assert.strictEqual(results.userData['email:confirmed'], 1);
					done();
				});
			});
		});
	});

	it('.should error if same password is used for reset', async () => {
		const uid = await user.create({ username: 'badmemory', email: 'bad@memory.com', password: '123456' });
		const code = await user.reset.generate(uid);
		let err;
		try {
			await user.reset.commit(code, '123456');
		} catch (_err) {
			err = _err;
		}
		assert.strictEqual(err.message, '[[error:reset-same-password]]');
	});

	it('should not validate email if password reset is due to expiry', async () => {
		const uid = await user.create({ username: 'resetexpiry', email: 'reset@expiry.com', password: '123456' });
		let confirmed = await user.getUserField(uid, 'email:confirmed');
		let [verified, unverified] = await groups.isMemberOfGroups(uid, ['verified-users', 'unverified-users']);
		assert.strictEqual(confirmed, 0);
		assert.strictEqual(verified, false);
		assert.strictEqual(unverified, true);
		await user.setUserField(uid, 'passwordExpiry', Date.now());
		const code = await user.reset.generate(uid);
		await user.reset.commit(code, '654321');
		confirmed = await user.getUserField(uid, 'email:confirmed');
		[verified, unverified] = await groups.isMemberOfGroups(uid, ['verified-users', 'unverified-users']);
		assert.strictEqual(confirmed, 0);
		assert.strictEqual(verified, false);
		assert.strictEqual(unverified, true);
	});
});

describe('locks', () => {
	let uid;
	let email;
	beforeEach(async () => {
		const [username, password] = [utils.generateUUID().slice(0, 10), utils.generateUUID()];
		uid = await user.create({ username, password });
		email = `${username}@nodebb.org`;
		await user.setUserField(uid, 'email', email);
		await user.email.confirmByUid(uid);
	});

	it('should disallow reset request if one was made within the minute', async () => {
		await user.reset.send(email);
		await assert.rejects(user.reset.send(email), {
			message: '[[error:reset-rate-limited]]',
		});
	});

	it('should not allow multiple calls to the reset method at the same time', async () => {
		await assert.rejects(Promise.all([
			user.reset.send(email),
			user.reset.send(email),
		]), {
			message: '[[error:reset-rate-limited]]',
		});
	});

	it('should not allow multiple socket calls to the reset method either', async () => {
		await assert.rejects(Promise.all([
			socketUser.reset.send({ uid: 0 }, email),
			socketUser.reset.send({ uid: 0 }, email),
		]), {
			message: '[[error:reset-rate-limited]]',
		});
	});

	it('should properly unlock user reset', async () => {
		await user.reset.send(email);
		await assert.rejects(user.reset.send(email), {
			message: '[[error:reset-rate-limited]]',
		});
		user.reset.minSecondsBetweenEmails = 3;
		const util = require('util');
		const sleep = util.promisify(setTimeout);
		await sleep(4 * 1000); // wait 4 seconds
		await user.reset.send(email);
		user.reset.minSecondsBetweenEmails = 60;
	});
});
