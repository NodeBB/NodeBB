'use strict';

const assert = require('assert');
const nconf = require('nconf');
const request = require('request-promise-native');
const db = require('./mocks/databasemock');
const middleware = require('../src/middleware');
const user = require('../src/user');
const groups = require('../src/groups');
const utils = require('../src/utils');

const helpers = require('./helpers');

describe('Middlewares', () => {
	describe('expose', () => {
		let adminUid;

		before(async () => {
			adminUid = await user.create({ username: 'admin', password: '123456' });
			await groups.join('administrators', adminUid);
		});

		it('should expose res.locals.isAdmin = false', (done) => {
			const resMock = { locals: {} };
			middleware.exposeAdmin({}, resMock, () => {
				assert.strictEqual(resMock.locals.isAdmin, false);
				done();
			});
		});

		it('should expose res.locals.isAdmin = true', (done) => {
			const reqMock = { user: { uid: adminUid } };
			const resMock = { locals: {} };
			middleware.exposeAdmin(reqMock, resMock, () => {
				assert.strictEqual(resMock.locals.isAdmin, true);
				done();
			});
		});

		it('should expose privileges in res.locals.privileges and isSelf=true', (done) => {
			const reqMock = { user: { uid: adminUid }, params: { uid: adminUid } };
			const resMock = { locals: {} };
			middleware.exposePrivileges(reqMock, resMock, () => {
				assert(resMock.locals.privileges);
				assert.strictEqual(resMock.locals.privileges.isAdmin, true);
				assert.strictEqual(resMock.locals.privileges.isGmod, false);
				assert.strictEqual(resMock.locals.privileges.isPrivileged, true);
				assert.strictEqual(resMock.locals.privileges.isSelf, true);
				done();
			});
		});

		it('should expose privileges in res.locals.privileges and isSelf=false', (done) => {
			const reqMock = { user: { uid: 0 }, params: { uid: adminUid } };
			const resMock = { locals: {} };
			middleware.exposePrivileges(reqMock, resMock, () => {
				assert(resMock.locals.privileges);
				assert.strictEqual(resMock.locals.privileges.isAdmin, false);
				assert.strictEqual(resMock.locals.privileges.isGmod, false);
				assert.strictEqual(resMock.locals.privileges.isPrivileged, false);
				assert.strictEqual(resMock.locals.privileges.isSelf, false);
				done();
			});
		});

		it('should expose privilege set', (done) => {
			const reqMock = { user: { uid: adminUid } };
			const resMock = { locals: {} };
			middleware.exposePrivilegeSet(reqMock, resMock, () => {
				assert(resMock.locals.privileges);
				assert.deepStrictEqual(resMock.locals.privileges, {
					chat: true,
					'upload:post:image': true,
					'upload:post:file': true,
					signature: true,
					invite: true,
					'group:create': true,
					'search:content': true,
					'search:users': true,
					'search:tags': true,
					'view:users': true,
					'view:tags': true,
					'view:groups': true,
					'local:login': true,
					ban: true,
					mute: true,
					'view:users:info': true,
					'admin:dashboard': true,
					'admin:categories': true,
					'admin:privileges': true,
					'admin:admins-mods': true,
					'admin:users': true,
					'admin:groups': true,
					'admin:tags': true,
					'admin:settings': true,
					superadmin: true,
				});
				done();
			});
		});
	});

	describe('.inhibitCache (cache-control header)', () => {
		let uid;
		let jar;

		before(async () => {
			uid = await user.create({ username: 'testuser', password: '123456' });
			({ jar } = await helpers.loginUser('testuser', '123456'));
		});

		it('should be absent on non-existent routes, for guests', async () => {
			const res = await request(`${nconf.get('url')}/${utils.generateUUID()}`, {
				simple: false,
				resolveWithFullResponse: true,
			});

			assert.strictEqual(res.statusCode, 404);
			assert(!Object.keys(res.headers).includes('cache-control'));
		});

		it('should be set to "private" on non-existent routes, for logged in users', async () => {
			const res = await request(`${nconf.get('url')}/${utils.generateUUID()}`, {
				simple: false,
				resolveWithFullResponse: true,
				jar,
			});

			assert.strictEqual(res.statusCode, 404);
			assert(Object.keys(res.headers).includes('cache-control'));
			assert.strictEqual(res.headers['cache-control'], 'private');
		});

		it('should be absent on regular routes, for guests', async () => {
			const res = await request(nconf.get('url'), {
				simple: false,
				resolveWithFullResponse: true,
			});

			assert.strictEqual(res.statusCode, 200);
			assert(!Object.keys(res.headers).includes('cache-control'));
		});

		it('should be absent on api routes, for guests', async () => {
			const res = await request(`${nconf.get('url')}/api`, {
				simple: false,
				resolveWithFullResponse: true,
			});

			assert.strictEqual(res.statusCode, 200);
			assert(!Object.keys(res.headers).includes('cache-control'));
		});

		it('should be set to "private" on regular routes, for logged-in users', async () => {
			const res = await request(nconf.get('url'), {
				simple: false,
				resolveWithFullResponse: true,
				jar,
			});

			assert.strictEqual(res.statusCode, 200);
			assert(Object.keys(res.headers).includes('cache-control'));
			assert.strictEqual(res.headers['cache-control'], 'private');
		});

		it('should be set to "private" on api routes, for logged-in users', async () => {
			const res = await request(`${nconf.get('url')}/api`, {
				simple: false,
				resolveWithFullResponse: true,
				jar,
			});

			assert.strictEqual(res.statusCode, 200);
			assert(Object.keys(res.headers).includes('cache-control'));
			assert.strictEqual(res.headers['cache-control'], 'private');
		});

		it('should be set to "private" on apiv3 routes, for logged-in users', async () => {
			const res = await request(`${nconf.get('url')}/api/v3/users/${uid}`, {
				simple: false,
				resolveWithFullResponse: true,
				jar,
			});

			assert.strictEqual(res.statusCode, 200);
			assert(Object.keys(res.headers).includes('cache-control'));
			assert.strictEqual(res.headers['cache-control'], 'private');
		});
	});
});

