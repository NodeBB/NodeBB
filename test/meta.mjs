import { createRequire } from 'module';
const require = createRequire(import.meta.url);
import assert from 'node:assert';
import nconf from 'nconf';
import async from 'async';

import db from './mocks/databasemock.mjs';
import meta from '../src/meta/index.js';
import User from '../src/user/index.js';
import Groups from '../src/groups/index.js';
import request from '../src/request.js';
import socketAdmin from '../src/socket.io/admin.js';


describe('meta', () => {
	let fooUid;
	let bazUid;
	let herpUid;

	before(async () => {
		await Groups.cache.reset();
		// Create 3 users: 1 admin, 2 regular
		const uids = await async.series([
			async.apply(User.create, { username: 'foo', password: 'barbar' }), // admin
			async.apply(User.create, { username: 'baz', password: 'quuxquux' }), // restricted user
			async.apply(User.create, { username: 'herp', password: 'derpderp' }), // regular user
		]);

		fooUid = uids[0];
		bazUid = uids[1];
		herpUid = uids[2];

		await Groups.join('administrators', fooUid);
	});

	describe('settings', () => {
		it('should set setting', async () => {
			await socketAdmin.settings.set(
				{ uid: fooUid },
				{ hash: 'some:hash', values: { foo: '1', derp: 'value' } }
			);
			const data = await db.getObject('settings:some:hash');
			assert.strictEqual(data.foo, '1');
			assert.strictEqual(data.derp, 'value');
		});

		it('should get setting', async () => {
			const data = await socketAdmin.settings.get(
				{ uid: fooUid },
				{ hash: 'some:hash' }
			);
			assert.strictEqual(data.foo, '1');
			assert.strictEqual(data.derp, 'value');
		});

		it('should not set setting if not empty', async () => {
			await meta.settings.setOnEmpty('some:hash', { foo: 2 });
			const data = await db.getObject('settings:some:hash');
			assert.strictEqual(data.foo, '1');
			assert.strictEqual(data.derp, 'value');
		});

		it('should set setting if empty', async () => {
			await meta.settings.setOnEmpty('some:hash', { empty: '2' });
			const data = await db.getObject('settings:some:hash');
			assert.strictEqual(data.foo, '1');
			assert.strictEqual(data.derp, 'value');
			assert.strictEqual(data.empty, '2');
		});

		it('should set one and get one', async () => {
			await meta.settings.setOne('some:hash', 'myField', 'myValue');
			const myValue = await meta.settings.getOne('some:hash', 'myField');
			assert.strictEqual(myValue, 'myValue');
		});

		it('should return null if setting field does not exist', async () => {
			const val = await meta.settings.getOne('some:hash', 'does not exist');
			assert.strictEqual(val, null);
		});

		const someList = [
			{ name: 'andrew', status: 'best' },
			{ name: 'baris', status: 'wurst' },
		];
		const anotherList = [];

		it('should set setting with sorted list', async () => {
			await socketAdmin.settings.set(
				{ uid: fooUid },
				{
					hash: 'another:hash',
					values: { foo: '1', derp: 'value', someList, anotherList },
				}
			);
			const data = await db.getObject('settings:another:hash');
			assert.strictEqual(data.foo, '1');
			assert.strictEqual(data.derp, 'value');
			assert.strictEqual(data.someList, undefined);
			assert.strictEqual(data.anotherList, undefined);
		});

		it('should get setting with sorted list', async () => {
			const data = await socketAdmin.settings.get(
				{ uid: fooUid },
				{ hash: 'another:hash' }
			);
			assert.strictEqual(data.foo, '1');
			assert.strictEqual(data.derp, 'value');
			assert.deepStrictEqual(data.someList, someList);
			assert.deepStrictEqual(data.anotherList, anotherList);
		});

		it('should not set setting if not empty', async () => {
			await meta.settings.setOnEmpty('some:hash', { foo: 2 });
			const data = await db.getObject('settings:some:hash');
			assert.strictEqual(data.foo, '1');
			assert.strictEqual(data.derp, 'value');
		});

		it('should not set setting with sorted list if not empty', async () => {
			await meta.settings.setOnEmpty('another:hash', { foo: anotherList });
			const data = await socketAdmin.settings.get(
				{ uid: fooUid },
				{ hash: 'another:hash' }
			);
			assert.strictEqual(data.foo, '1');
			assert.strictEqual(data.derp, 'value');
		});

		it('should set setting with sorted list if empty', async () => {
			await meta.settings.setOnEmpty('another:hash', { empty: someList });
			const data = await socketAdmin.settings.get(
				{ uid: fooUid },
				{ hash: 'another:hash' }
			);
			assert.strictEqual(data.foo, '1');
			assert.strictEqual(data.derp, 'value');
			assert.deepStrictEqual(data.empty, someList);
		});

		it('should set one and get one sorted list', async () => {
			await meta.settings.setOne('another:hash', 'someList', someList);
			const _someList = await meta.settings.getOne('another:hash', 'someList');
			assert.deepStrictEqual(_someList, someList);
		});
	});

	describe('config', () => {
		before(async () => {
			await db.setObject('config', {
				minimumTagLength: 3,
				maximumTagLength: 15,
			});
		});

		it('should get config fields', async () => {
			const data = await meta.configs.getFields([
				'minimumTagLength',
				'maximumTagLength',
			]);
			assert.strictEqual(data.minimumTagLength, 3);
			assert.strictEqual(data.maximumTagLength, 15);
		});

		it('should get the correct type and default value', async () => {
			await meta.configs.set('loginAttempts', '');
			const value = await meta.configs.get('loginAttempts');
			assert.strictEqual(value, 5);
		});

		it('should get the correct type and correct value', async () => {
			await meta.configs.set('loginAttempts', '0');
			const value = await meta.configs.get('loginAttempts');
			assert.strictEqual(value, 0);
		});

		it('should get the correct value', async () => {
			await meta.configs.set('title', 123);
			const value = await meta.configs.get('title');
			assert.strictEqual(value, '123');
		});

		it('should get the correct value', async () => {
			await meta.configs.set('title', 0);
			const value = await meta.configs.get('title');
			assert.strictEqual(value, '0');
		});

		it('should get the correct value', async () => {
			await meta.configs.set('title', '');
			const value = await meta.configs.get('title');
			assert.strictEqual(value, '');
		});

		it('should use default value if value is null', async () => {
			await meta.configs.set('teaserPost', null);
			const value = await meta.configs.get('teaserPost');
			assert.strictEqual(value, 'last-reply');
		});

		it('should fail if field is invalid', async () => {
			await assert.rejects(
				meta.configs.set('', 'someValue'),
				{ message: '[[error:invalid-data]]' }
			);
		});

		it('should fail if data is invalid', async () => {
			await assert.rejects(
				socketAdmin.config.set({ uid: fooUid }, null),
				{ message: '[[error:invalid-data]]' }
			);
		});

		it('should set multiple config values', async () => {
			await socketAdmin.config.set(
				{ uid: fooUid },
				{ key: 'someKey', value: 'someValue' }
			);
			const data = await meta.configs.getFields(['someKey']);
			assert.strictEqual(data.someKey, 'someValue');
		});

		it('should set config value', async () => {
			await meta.configs.set('someField', 'someValue');
			const data = await meta.configs.getFields(['someField']);
			assert.strictEqual(data.someField, 'someValue');
		});

		it('should get back string if field is not in defaults', async () => {
			await meta.configs.set('numericField', 123);
			const data = await meta.configs.getFields(['numericField']);
			assert.strictEqual(data.numericField, 123);
		});

		it('should set boolean config value', async () => {
			await meta.configs.set('booleanField', true);
			const data = await meta.configs.getFields(['booleanField']);
			assert.strictEqual(data.booleanField, true);
		});

		it('should set boolean config value', async () => {
			await meta.configs.set('booleanField', 'false');
			const data = await meta.configs.getFields(['booleanField']);
			assert.strictEqual(data.booleanField, false);
		});

		it('should set string config value', async () => {
			await meta.configs.set('stringField', '123');
			const data = await meta.configs.getFields(['stringField']);
			assert.strictEqual(data.stringField, 123);
		});

		it('should fail if data is invalid', async () => {
			await assert.rejects(
				socketAdmin.config.setMultiple({ uid: fooUid }, null),
				{ message: '[[error:invalid-data]]' }
			);
		});

		it('should set multiple values', async () => {
			await socketAdmin.config.setMultiple(
				{ uid: fooUid },
				{
					someField1: 'someValue1',
					someField2: 'someValue2',
					customCSS: '.derp{color:#00ff00;}',
				}
			);
			const data = await meta.configs.getFields(['someField1', 'someField2']);
			assert.strictEqual(data.someField1, 'someValue1');
			assert.strictEqual(data.someField2, 'someValue2');
		});

		it('should not set config if not empty', async () => {
			await meta.configs.setOnEmpty({ someField1: 'foo' });
			const value = await meta.configs.get('someField1');
			assert.strictEqual(value, 'someValue1');
		});

		it('should remove config field', async () => {
			await socketAdmin.config.remove({ uid: fooUid }, 'someField1');
			const isObjectField = await db.isObjectField('config', 'someField1');
			assert.strictEqual(isObjectField, false);
		});
	});

	describe('session TTL', () => {
		it('should return 14 days in seconds', () => {
			assert.strictEqual(meta.getSessionTTLSeconds(), 1209600);
		});

		it('should return 7 days in seconds', () => {
			meta.config.loginDays = 7;
			assert.strictEqual(meta.getSessionTTLSeconds(), 604800);
		});

		it('should return 2 days in seconds', () => {
			meta.config.loginSeconds = 172800;
			assert.strictEqual(meta.getSessionTTLSeconds(), 172800);
		});
	});

	describe('dependencies', () => {
		it('should return ENOENT if module is not found', async () => {
			await assert.rejects(
				meta.dependencies.checkModule('some-module-that-does-not-exist'),
				{ code: 'ENOENT' }
			);
		});

		it('should not error if module is a nodebb-plugin-*', async () => {
			await meta.dependencies.checkModule('nodebb-plugin-somePlugin');
		});

		it('should not error if module is nodebb-theme-*', async () => {
			await meta.dependencies.checkModule('nodebb-theme-someTheme0Theme');
		});

		it('should parse json package data', () => {
			const pkgData = meta.dependencies.parseModuleData(
				'nodebb-plugin-test',
				'{"a": 1}'
			);
			assert.strictEqual(pkgData.a, 1);
		});

		it('should return null data with invalid json', () => {
			const pkgData = meta.dependencies.parseModuleData(
				'nodebb-plugin-test',
				'asdasd'
			);
			assert.strictEqual(pkgData, null);
		});

		it('should return false if moduleData is falsy', () => {
			assert.strictEqual(meta.dependencies.doesSatisfy(null, '1.0.0'), false);
		});

		it('should return false if moduleData doesnt not satisfy package.json', () => {
			assert.strictEqual(
				meta.dependencies.doesSatisfy(
					{ name: 'nodebb-plugin-test', version: '0.9.0' },
					'1.0.0'
				),
				false
			);
		});

		it('should return true if _resolved is from github', () => {
			assert.strictEqual(
				meta.dependencies.doesSatisfy(
					{
						name: 'nodebb-plugin-test',
						_resolved: 'https://github.com/some/repo',
						version: '0.9.0',
					},
					'1.0.0'
				),
				true
			);
		});
	});

	describe('debugFork', () => {
		let oldArgv;
		before(() => {
			oldArgv = process.execArgv;
		});

		it('should detect debugging', async () => {
			// const oldArgv = process.execArgv;
			process.execArgv = [];
			const debugForkPath = require.resolve('../src/meta/debugFork');
			delete require.cache[debugForkPath];
			let debugFork = require('../src/meta/debugFork.js');
			assert.strictEqual(debugFork.debugging, false);

			// Simulate re-importing the module
			process.execArgv = ['--debug=5858', '--foo=1'];
			delete require.cache[debugForkPath];
			debugFork = require('../src/meta/debugFork.js');
			assert.strictEqual(debugFork.debugging, true);
		});

		after(() => {
			process.execArgv = oldArgv;
			const debugForkPath = require.resolve('../src/meta/debugFork');
			delete require.cache[debugForkPath];
			require('../src/meta/debugFork.js');
		});
	});

	describe('Access-Control-Allow-Origin', () => {
		it('Access-Control-Allow-Origin header should be empty', async () => {
			const jar = request.jar();
			const { response } = await request.get(
				`${nconf.get('url')}/api/search?term=bug`,
				{ jar }
			);

			assert.equal(response.headers['access-control-allow-origin'], undefined);
		});

		it('should set proper Access-Control-Allow-Origin header', async () => {
			const jar = request.jar();
			const oldValue = meta.config['access-control-allow-origin'];
			meta.config['access-control-allow-origin'] = 'test.com, mydomain.com';
			const { response } = await request.get(
				`${nconf.get('url')}/api/search?term=bug`,
				{
					jar,
					headers: {
						origin: 'mydomain.com',
					},
				}
			);

			assert.equal(response.headers['access-control-allow-origin'], 'mydomain.com');
			meta.config['access-control-allow-origin'] = oldValue;
		});

		it('Access-Control-Allow-Origin header should be empty if origin does not match', async () => {
			const jar = request.jar();
			const oldValue = meta.config['access-control-allow-origin'];
			meta.config['access-control-allow-origin'] = 'test.com, mydomain.com';
			const { response } = await request.get(
				`${nconf.get('url')}/api/search?term=bug`,
				{
					data: {},
					jar,
					headers: {
						origin: 'notallowed.com',
					},
				}
			);
			assert.equal(response.headers['access-control-allow-origin'], undefined);
			meta.config['access-control-allow-origin'] = oldValue;
		});

		it('should set proper Access-Control-Allow-Origin header', async () => {
			const jar = request.jar();
			const oldValue = meta.config['access-control-allow-origin-regex'];
			meta.config['access-control-allow-origin-regex'] =
				'match\\.this\\..+\\.domain.com, mydomain\\.com';
			const { response } = await request.get(
				`${nconf.get('url')}/api/search?term=bug`,
				{
					jar,
					headers: {
						origin: 'match.this.anything123.domain.com',
					},
				}
			);

			assert.equal(
				response.headers['access-control-allow-origin'],
				'match.this.anything123.domain.com'
			);
			meta.config['access-control-allow-origin-regex'] = oldValue;
		});

		it('Access-Control-Allow-Origin header should be empty if origin does not match', async () => {
			const jar = request.jar();
			const oldValue = meta.config['access-control-allow-origin-regex'];
			meta.config['access-control-allow-origin-regex'] =
				'match\\.this\\..+\\.domain.com, mydomain\\.com';
			const { response } = await request.get(
				`${nconf.get('url')}/api/search?term=bug`,
				{
					jar,
					headers: {
						origin: 'notallowed.com',
					},
				}
			);
			assert.equal(response.headers['access-control-allow-origin'], undefined);
			meta.config['access-control-allow-origin-regex'] = oldValue;
		});

		it('should not error with invalid regexp', async () => {
			const jar = request.jar();
			const oldValue = meta.config['access-control-allow-origin-regex'];
			meta.config['access-control-allow-origin-regex'] =
				'[match\\.this\\..+\\.domain.com, mydomain\\.com';
			const { response } = await request.get(
				`${nconf.get('url')}/api/search?term=bug`,
				{
					jar,
					headers: {
						origin: 'mydomain.com',
					},
				}
			);
			assert.equal(response.headers['access-control-allow-origin'], 'mydomain.com');
			meta.config['access-control-allow-origin-regex'] = oldValue;
		});
	});

	it('should log targets', async () => {
		const aliases = await import('../src/meta/aliases.js');
		await aliases.buildTargets();
	});
});