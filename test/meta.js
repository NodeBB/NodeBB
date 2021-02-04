'use strict';

const assert = require('assert');
const async = require('async');
const request = require('request');
const nconf = require('nconf');

const db = require('./mocks/databasemock');
const meta = require('../src/meta');
const User = require('../src/user');
const Groups = require('../src/groups');

describe('meta', () => {
	let fooUid;
	let bazUid;
	let herpUid;

	before((done) => {
		Groups.cache.reset();
		// Create 3 users: 1 admin, 2 regular
		async.series([
			async.apply(User.create, { username: 'foo', password: 'barbar' }),	// admin
			async.apply(User.create, { username: 'baz', password: 'quuxquux' }),	// restricted user
			async.apply(User.create, { username: 'herp', password: 'derpderp' }),	// regular user
		], (err, uids) => {
			if (err) {
				return done(err);
			}

			fooUid = uids[0];
			bazUid = uids[1];
			herpUid = uids[2];

			Groups.join('administrators', fooUid, done);
		});
	});

	describe('settings', () => {
		const socketAdmin = require('../src/socket.io/admin');
		it('it should set setting', (done) => {
			socketAdmin.settings.set({ uid: fooUid }, { hash: 'some:hash', values: { foo: '1', derp: 'value' } }, (err) => {
				assert.ifError(err);
				db.getObject('settings:some:hash', (err, data) => {
					assert.ifError(err);
					assert.equal(data.foo, '1');
					assert.equal(data.derp, 'value');
					done();
				});
			});
		});

		it('it should get setting', (done) => {
			socketAdmin.settings.get({ uid: fooUid }, { hash: 'some:hash' }, (err, data) => {
				assert.ifError(err);
				assert.equal(data.foo, '1');
				assert.equal(data.derp, 'value');
				done();
			});
		});

		it('should not set setting if not empty', (done) => {
			meta.settings.setOnEmpty('some:hash', { foo: 2 }, (err) => {
				assert.ifError(err);
				db.getObject('settings:some:hash', (err, data) => {
					assert.ifError(err);
					assert.equal(data.foo, '1');
					assert.equal(data.derp, 'value');
					done();
				});
			});
		});

		it('should set setting if empty', (done) => {
			meta.settings.setOnEmpty('some:hash', { empty: '2' }, (err) => {
				assert.ifError(err);
				db.getObject('settings:some:hash', (err, data) => {
					assert.ifError(err);
					assert.equal(data.foo, '1');
					assert.equal(data.derp, 'value');
					assert.equal(data.empty, '2');
					done();
				});
			});
		});

		it('should set one and get one', (done) => {
			meta.settings.setOne('some:hash', 'myField', 'myValue', (err) => {
				assert.ifError(err);
				meta.settings.getOne('some:hash', 'myField', (err, myValue) => {
					assert.ifError(err);
					assert.equal(myValue, 'myValue');
					done();
				});
			});
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

		it('should set setting with sorted list', (done) => {
			socketAdmin.settings.set({ uid: fooUid }, { hash: 'another:hash', values: { foo: '1', derp: 'value', someList: someList, anotherList: anotherList } }, (err) => {
				if (err) {
					return done(err);
				}

				db.getObject('settings:another:hash', (err, data) => {
					if (err) {
						return done(err);
					}

					assert.equal(data.foo, '1');
					assert.equal(data.derp, 'value');
					assert.equal(data.someList, undefined);
					assert.equal(data.anotherList, undefined);
					done();
				});
			});
		});

		it('should get setting with sorted list', (done) => {
			socketAdmin.settings.get({ uid: fooUid }, { hash: 'another:hash' }, (err, data) => {
				assert.ifError(err);
				assert.strictEqual(data.foo, '1');
				assert.strictEqual(data.derp, 'value');
				assert.deepStrictEqual(data.someList, someList);
				assert.deepStrictEqual(data.anotherList, anotherList);
				done();
			});
		});

		it('should not set setting if not empty', (done) => {
			meta.settings.setOnEmpty('some:hash', { foo: 2 }, (err) => {
				assert.ifError(err);
				db.getObject('settings:some:hash', (err, data) => {
					assert.ifError(err);
					assert.equal(data.foo, '1');
					assert.equal(data.derp, 'value');
					done();
				});
			});
		});

		it('should not set setting with sorted list if not empty', (done) => {
			meta.settings.setOnEmpty('another:hash', { foo: anotherList }, (err) => {
				assert.ifError(err);
				socketAdmin.settings.get({ uid: fooUid }, { hash: 'another:hash' }, (err, data) => {
					assert.ifError(err);
					assert.equal(data.foo, '1');
					assert.equal(data.derp, 'value');
					done();
				});
			});
		});

		it('should set setting with sorted list if empty', (done) => {
			meta.settings.setOnEmpty('another:hash', { empty: someList }, (err) => {
				assert.ifError(err);
				socketAdmin.settings.get({ uid: fooUid }, { hash: 'another:hash' }, (err, data) => {
					assert.ifError(err);
					assert.equal(data.foo, '1');
					assert.equal(data.derp, 'value');
					assert.deepEqual(data.empty, someList);
					done();
				});
			});
		});

		it('should set one and get one sorted list', (done) => {
			meta.settings.setOne('another:hash', 'someList', someList, (err) => {
				assert.ifError(err);
				meta.settings.getOne('another:hash', 'someList', (err, _someList) => {
					assert.ifError(err);
					assert.deepEqual(_someList, someList);
					done();
				});
			});
		});
	});


	describe('config', () => {
		const socketAdmin = require('../src/socket.io/admin');
		before((done) => {
			db.setObject('config', { minimumTagLength: 3, maximumTagLength: 15 }, done);
		});

		it('should get config fields', (done) => {
			meta.configs.getFields(['minimumTagLength', 'maximumTagLength'], (err, data) => {
				assert.ifError(err);
				assert.strictEqual(data.minimumTagLength, 3);
				assert.strictEqual(data.maximumTagLength, 15);
				done();
			});
		});

		it('should get the correct type and default value', (done) => {
			meta.configs.set('loginAttempts', '', (err) => {
				assert.ifError(err);
				meta.configs.get('loginAttempts', (err, value) => {
					assert.ifError(err);
					assert.strictEqual(value, 5);
					done();
				});
			});
		});

		it('should get the correct type and correct value', (done) => {
			meta.configs.set('loginAttempts', '0', (err) => {
				assert.ifError(err);
				meta.configs.get('loginAttempts', (err, value) => {
					assert.ifError(err);
					assert.strictEqual(value, 0);
					done();
				});
			});
		});

		it('should get the correct value', (done) => {
			meta.configs.set('title', 123, (err) => {
				assert.ifError(err);
				meta.configs.get('title', (err, value) => {
					assert.ifError(err);
					assert.strictEqual(value, '123');
					done();
				});
			});
		});

		it('should get the correct value', (done) => {
			meta.configs.set('title', 0, (err) => {
				assert.ifError(err);
				meta.configs.get('title', (err, value) => {
					assert.ifError(err);
					assert.strictEqual(value, '0');
					done();
				});
			});
		});

		it('should get the correct value', (done) => {
			meta.configs.set('title', '', (err) => {
				assert.ifError(err);
				meta.configs.get('title', (err, value) => {
					assert.ifError(err);
					assert.strictEqual(value, '');
					done();
				});
			});
		});

		it('should use default value if value is null', (done) => {
			meta.configs.set('teaserPost', null, (err) => {
				assert.ifError(err);
				meta.configs.get('teaserPost', (err, value) => {
					assert.ifError(err);
					assert.strictEqual(value, 'last-reply');
					done();
				});
			});
		});

		it('should fail if field is invalid', (done) => {
			meta.configs.set('', 'someValue', (err) => {
				assert.equal(err.message, '[[error:invalid-data]]');
				done();
			});
		});

		it('should fail if data is invalid', (done) => {
			socketAdmin.config.set({ uid: fooUid }, null, (err) => {
				assert.equal(err.message, '[[error:invalid-data]]');
				done();
			});
		});

		it('should set multiple config values', (done) => {
			socketAdmin.config.set({ uid: fooUid }, { key: 'someKey', value: 'someValue' }, (err) => {
				assert.ifError(err);
				meta.configs.getFields(['someKey'], (err, data) => {
					assert.ifError(err);
					assert.equal(data.someKey, 'someValue');
					done();
				});
			});
		});

		it('should set config value', (done) => {
			meta.configs.set('someField', 'someValue', (err) => {
				assert.ifError(err);
				meta.configs.getFields(['someField'], (err, data) => {
					assert.ifError(err);
					assert.strictEqual(data.someField, 'someValue');
					done();
				});
			});
		});

		it('should get back string if field is not in defaults', (done) => {
			meta.configs.set('numericField', 123, (err) => {
				assert.ifError(err);
				meta.configs.getFields(['numericField'], (err, data) => {
					assert.ifError(err);
					assert.strictEqual(data.numericField, 123);
					done();
				});
			});
		});

		it('should set boolean config value', (done) => {
			meta.configs.set('booleanField', true, (err) => {
				assert.ifError(err);
				meta.configs.getFields(['booleanField'], (err, data) => {
					assert.ifError(err);
					assert.strictEqual(data.booleanField, true);
					done();
				});
			});
		});

		it('should set boolean config value', (done) => {
			meta.configs.set('booleanField', 'false', (err) => {
				assert.ifError(err);
				meta.configs.getFields(['booleanField'], (err, data) => {
					assert.ifError(err);
					assert.strictEqual(data.booleanField, false);
					done();
				});
			});
		});

		it('should set string config value', (done) => {
			meta.configs.set('stringField', '123', (err) => {
				assert.ifError(err);
				meta.configs.getFields(['stringField'], (err, data) => {
					assert.ifError(err);
					assert.strictEqual(data.stringField, 123);
					done();
				});
			});
		});

		it('should fail if data is invalid', (done) => {
			socketAdmin.config.setMultiple({ uid: fooUid }, null, (err) => {
				assert.equal(err.message, '[[error:invalid-data]]');
				done();
			});
		});

		it('should set multiple values', (done) => {
			socketAdmin.config.setMultiple({ uid: fooUid }, {
				someField1: 'someValue1',
				someField2: 'someValue2',
				customCSS: '.derp{color:#00ff00;}',
			}, (err) => {
				assert.ifError(err);
				meta.configs.getFields(['someField1', 'someField2'], (err, data) => {
					assert.ifError(err);
					assert.equal(data.someField1, 'someValue1');
					assert.equal(data.someField2, 'someValue2');
					done();
				});
			});
		});

		it('should not set config if not empty', (done) => {
			meta.configs.setOnEmpty({ someField1: 'foo' }, (err) => {
				assert.ifError(err);
				meta.configs.get('someField1', (err, value) => {
					assert.ifError(err);
					assert.equal(value, 'someValue1');
					done();
				});
			});
		});

		it('should remove config field', (done) => {
			socketAdmin.config.remove({ uid: fooUid }, 'someField1', (err) => {
				assert.ifError(err);
				db.isObjectField('config', 'someField1', (err, isObjectField) => {
					assert.ifError(err);
					assert(!isObjectField);
					done();
				});
			});
		});
	});


	describe('session TTL', () => {
		it('should return 14 days in seconds', (done) => {
			assert(meta.getSessionTTLSeconds(), 1209600);
			done();
		});

		it('should return 7 days in seconds', (done) => {
			meta.config.loginDays = 7;
			assert(meta.getSessionTTLSeconds(), 604800);
			done();
		});

		it('should return 2 days in seconds', (done) => {
			meta.config.loginSeconds = 172800;
			assert(meta.getSessionTTLSeconds(), 172800);
			done();
		});
	});

	describe('dependencies', () => {
		it('should return ENOENT if module is not found', (done) => {
			meta.dependencies.checkModule('some-module-that-does-not-exist', (err) => {
				assert.equal(err.code, 'ENOENT');
				done();
			});
		});

		it('should not error if module is a nodebb-plugin-*', (done) => {
			meta.dependencies.checkModule('nodebb-plugin-somePlugin', (err) => {
				assert.ifError(err);
				done();
			});
		});

		it('should not error if module is nodebb-theme-*', (done) => {
			meta.dependencies.checkModule('nodebb-theme-someTheme', (err) => {
				assert.ifError(err);
				done();
			});
		});

		it('should parse json package data', (done) => {
			const pkgData = meta.dependencies.parseModuleData('nodebb-plugin-test', '{"a": 1}');
			assert.equal(pkgData.a, 1);
			done();
		});

		it('should return null data with invalid json', (done) => {
			const pkgData = meta.dependencies.parseModuleData('nodebb-plugin-test', 'asdasd');
			assert.strictEqual(pkgData, null);
			done();
		});

		it('should return false if moduleData is falsy', (done) => {
			assert(!meta.dependencies.doesSatisfy(null, '1.0.0'));
			done();
		});

		it('should return false if moduleData doesnt not satisfy package.json', (done) => {
			assert(!meta.dependencies.doesSatisfy({ name: 'nodebb-plugin-test', version: '0.9.0' }, '1.0.0'));
			done();
		});

		it('should return true if _resolved is from github', (done) => {
			assert(meta.dependencies.doesSatisfy({ name: 'nodebb-plugin-test', _resolved: 'https://github.com/some/repo', version: '0.9.0' }, '1.0.0'));
			done();
		});
	});

	describe('debugFork', () => {
		let oldArgv;
		before(() => {
			oldArgv = process.execArgv;
			process.execArgv = ['--debug=5858', '--foo=1'];
		});

		it('should detect debugging', (done) => {
			let debugFork = require('../src/meta/debugFork');
			assert(!debugFork.debugging);

			const debugForkPath = require.resolve('../src/meta/debugFork');
			delete require.cache[debugForkPath];

			debugFork = require('../src/meta/debugFork');
			assert(debugFork.debugging);

			done();
		});

		after(() => {
			process.execArgv = oldArgv;
		});
	});

	describe('Access-Control-Allow-Origin', () => {
		it('Access-Control-Allow-Origin header should be empty', (done) => {
			const jar = request.jar();
			request.get(`${nconf.get('url')}/api/search?term=bug`, {
				form: {},
				json: true,
				jar: jar,
			}, (err, response, body) => {
				assert.ifError(err);
				assert.equal(response.headers['access-control-allow-origin'], undefined);
				done();
			});
		});

		it('should set proper Access-Control-Allow-Origin header', (done) => {
			const jar = request.jar();
			const oldValue = meta.config['access-control-allow-origin'];
			meta.config['access-control-allow-origin'] = 'test.com, mydomain.com';
			request.get(`${nconf.get('url')}/api/search?term=bug`, {
				form: {
				},
				json: true,
				jar: jar,
				headers: {
					origin: 'mydomain.com',
				},
			}, (err, response, body) => {
				assert.ifError(err);
				assert.equal(response.headers['access-control-allow-origin'], 'mydomain.com');
				meta.config['access-control-allow-origin'] = oldValue;
				done(err);
			});
		});

		it('Access-Control-Allow-Origin header should be empty if origin does not match', (done) => {
			const jar = request.jar();
			const oldValue = meta.config['access-control-allow-origin'];
			meta.config['access-control-allow-origin'] = 'test.com, mydomain.com';
			request.get(`${nconf.get('url')}/api/search?term=bug`, {
				form: {
				},
				json: true,
				jar: jar,
				headers: {
					origin: 'notallowed.com',
				},
			}, (err, response, body) => {
				assert.ifError(err);
				assert.equal(response.headers['access-control-allow-origin'], undefined);
				meta.config['access-control-allow-origin'] = oldValue;
				done(err);
			});
		});

		it('should set proper Access-Control-Allow-Origin header', (done) => {
			const jar = request.jar();
			const oldValue = meta.config['access-control-allow-origin-regex'];
			meta.config['access-control-allow-origin-regex'] = 'match\\.this\\..+\\.domain.com, mydomain\\.com';
			request.get(`${nconf.get('url')}/api/search?term=bug`, {
				form: {
				},
				json: true,
				jar: jar,
				headers: {
					origin: 'match.this.anything123.domain.com',
				},
			}, (err, response, body) => {
				assert.ifError(err);
				assert.equal(response.headers['access-control-allow-origin'], 'match.this.anything123.domain.com');
				meta.config['access-control-allow-origin-regex'] = oldValue;
				done(err);
			});
		});

		it('Access-Control-Allow-Origin header should be empty if origin does not match', (done) => {
			const jar = request.jar();
			const oldValue = meta.config['access-control-allow-origin-regex'];
			meta.config['access-control-allow-origin-regex'] = 'match\\.this\\..+\\.domain.com, mydomain\\.com';
			request.get(`${nconf.get('url')}/api/search?term=bug`, {
				form: {
				},
				json: true,
				jar: jar,
				headers: {
					origin: 'notallowed.com',
				},
			}, (err, response, body) => {
				assert.ifError(err);
				assert.equal(response.headers['access-control-allow-origin'], undefined);
				meta.config['access-control-allow-origin-regex'] = oldValue;
				done(err);
			});
		});

		it('should not error with invalid regexp', (done) => {
			const jar = request.jar();
			const oldValue = meta.config['access-control-allow-origin-regex'];
			meta.config['access-control-allow-origin-regex'] = '[match\\.this\\..+\\.domain.com, mydomain\\.com';
			request.get(`${nconf.get('url')}/api/search?term=bug`, {
				form: {
				},
				json: true,
				jar: jar,
				headers: {
					origin: 'mydomain.com',
				},
			}, (err, response, body) => {
				assert.ifError(err);
				assert.equal(response.headers['access-control-allow-origin'], 'mydomain.com');
				meta.config['access-control-allow-origin-regex'] = oldValue;
				done(err);
			});
		});
	});
});
