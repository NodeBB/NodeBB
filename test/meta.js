'use strict';

var assert = require('assert');
var async = require('async');
var request = require('request');
var nconf = require('nconf');

var db = require('./mocks/databasemock');
var meta = require('../src/meta');
var User = require('../src/user');
var Groups = require('../src/groups');

describe('meta', function () {
	var fooUid;
	var bazUid;
	var herpUid;

	before(function (done) {
		Groups.resetCache();
		// Create 3 users: 1 admin, 2 regular
		async.series([
			async.apply(User.create, { username: 'foo', password: 'barbar' }),	// admin
			async.apply(User.create, { username: 'baz', password: 'quuxquux' }),	// restricted user
			async.apply(User.create, { username: 'herp', password: 'derpderp' }),	// regular user
		], function (err, uids) {
			if (err) {
				return done(err);
			}

			fooUid = uids[0];
			bazUid = uids[1];
			herpUid = uids[2];

			Groups.join('administrators', fooUid, done);
		});
	});

	describe('settings', function () {
		var socketAdmin = require('../src/socket.io/admin');
		it('it should set setting', function (done) {
			socketAdmin.settings.set({ uid: fooUid }, { hash: 'some:hash', values: { foo: '1', derp: 'value' } }, function (err) {
				assert.ifError(err);
				db.getObject('settings:some:hash', function (err, data) {
					assert.ifError(err);
					assert.equal(data.foo, '1');
					assert.equal(data.derp, 'value');
					done();
				});
			});
		});

		it('it should get setting', function (done) {
			socketAdmin.settings.get({ uid: fooUid }, { hash: 'some:hash' }, function (err, data) {
				assert.ifError(err);
				assert.equal(data.foo, '1');
				assert.equal(data.derp, 'value');
				done();
			});
		});

		it('should not set setting if not empty', function (done) {
			meta.settings.setOnEmpty('some:hash', { foo: 2 }, function (err) {
				assert.ifError(err);
				db.getObject('settings:some:hash', function (err, data) {
					assert.ifError(err);
					assert.equal(data.foo, '1');
					assert.equal(data.derp, 'value');
					done();
				});
			});
		});

		it('should set setting if empty', function (done) {
			meta.settings.setOnEmpty('some:hash', { empty: '2' }, function (err) {
				assert.ifError(err);
				db.getObject('settings:some:hash', function (err, data) {
					assert.ifError(err);
					assert.equal(data.foo, '1');
					assert.equal(data.derp, 'value');
					assert.equal(data.empty, '2');
					done();
				});
			});
		});

		it('should set one and get one', function (done) {
			meta.settings.setOne('some:hash', 'myField', 'myValue', function (err) {
				assert.ifError(err);
				meta.settings.getOne('some:hash', 'myField', function (err, myValue) {
					assert.ifError(err);
					assert.equal(myValue, 'myValue');
					done();
				});
			});
		});
	});


	describe('config', function () {
		var socketAdmin = require('../src/socket.io/admin');
		before(function (done) {
			db.setObject('config', { minimumTagLength: 3, maximumTagLength: 15 }, done);
		});

		it('should get config fields', function (done) {
			meta.configs.getFields(['minimumTagLength', 'maximumTagLength'], function (err, data) {
				assert.ifError(err);
				assert.strictEqual(data.minimumTagLength, 3);
				assert.strictEqual(data.maximumTagLength, 15);
				done();
			});
		});

		it('should get the correct type and default value', function (done) {
			meta.configs.set('loginAttempts', '', function (err) {
				assert.ifError(err);
				meta.configs.get('loginAttempts', function (err, value) {
					assert.ifError(err);
					assert.strictEqual(value, 5);
					done();
				});
			});
		});

		it('should get the correct type and correct value', function (done) {
			meta.configs.set('loginAttempts', '0', function (err) {
				assert.ifError(err);
				meta.configs.get('loginAttempts', function (err, value) {
					assert.ifError(err);
					assert.strictEqual(value, 0);
					done();
				});
			});
		});

		it('should get the correct value', function (done) {
			meta.configs.set('title', 123, function (err) {
				assert.ifError(err);
				meta.configs.get('title', function (err, value) {
					assert.ifError(err);
					assert.strictEqual(value, '123');
					done();
				});
			});
		});

		it('should get the correct value', function (done) {
			meta.configs.set('title', 0, function (err) {
				assert.ifError(err);
				meta.configs.get('title', function (err, value) {
					assert.ifError(err);
					assert.strictEqual(value, '0');
					done();
				});
			});
		});

		it('should get the correct value', function (done) {
			meta.configs.set('title', '', function (err) {
				assert.ifError(err);
				meta.configs.get('title', function (err, value) {
					assert.ifError(err);
					assert.strictEqual(value, '');
					done();
				});
			});
		});

		it('should use default value if value is null', function (done) {
			meta.configs.set('teaserPost', null, function (err) {
				assert.ifError(err);
				meta.configs.get('teaserPost', function (err, value) {
					assert.ifError(err);
					assert.strictEqual(value, 'last-reply');
					done();
				});
			});
		});

		it('should fail if field is invalid', function (done) {
			meta.configs.set('', 'someValue', function (err) {
				assert.equal(err.message, '[[error:invalid-data]]');
				done();
			});
		});

		it('should fail if data is invalid', function (done) {
			socketAdmin.config.set({ uid: fooUid }, null, function (err) {
				assert.equal(err.message, '[[error:invalid-data]]');
				done();
			});
		});

		it('should set multiple config values', function (done) {
			socketAdmin.config.set({ uid: fooUid }, { key: 'someKey', value: 'someValue' }, function (err) {
				assert.ifError(err);
				meta.configs.getFields(['someKey'], function (err, data) {
					assert.ifError(err);
					assert.equal(data.someKey, 'someValue');
					done();
				});
			});
		});

		it('should set config value', function (done) {
			meta.configs.set('someField', 'someValue', function (err) {
				assert.ifError(err);
				meta.configs.getFields(['someField'], function (err, data) {
					assert.ifError(err);
					assert.strictEqual(data.someField, 'someValue');
					done();
				});
			});
		});

		it('should get back string if field is not in defaults', function (done) {
			meta.configs.set('numericField', 123, function (err) {
				assert.ifError(err);
				meta.configs.getFields(['numericField'], function (err, data) {
					assert.ifError(err);
					assert.strictEqual(data.numericField, 123);
					done();
				});
			});
		});

		it('should set boolean config value', function (done) {
			meta.configs.set('booleanField', true, function (err) {
				assert.ifError(err);
				meta.configs.getFields(['booleanField'], function (err, data) {
					assert.ifError(err);
					assert.strictEqual(data.booleanField, true);
					done();
				});
			});
		});

		it('should set boolean config value', function (done) {
			meta.configs.set('booleanField', 'false', function (err) {
				assert.ifError(err);
				meta.configs.getFields(['booleanField'], function (err, data) {
					assert.ifError(err);
					assert.strictEqual(data.booleanField, false);
					done();
				});
			});
		});

		it('should set string config value', function (done) {
			meta.configs.set('stringField', '123', function (err) {
				assert.ifError(err);
				meta.configs.getFields(['stringField'], function (err, data) {
					assert.ifError(err);
					assert.strictEqual(data.stringField, 123);
					done();
				});
			});
		});

		it('should fail if data is invalid', function (done) {
			socketAdmin.config.setMultiple({ uid: fooUid }, null, function (err) {
				assert.equal(err.message, '[[error:invalid-data]]');
				done();
			});
		});

		it('should set multiple values', function (done) {
			socketAdmin.config.setMultiple({ uid: fooUid }, {
				someField1: 'someValue1',
				someField2: 'someValue2',
				customCSS: '.derp{color:#00ff00;}',
			}, function (err) {
				assert.ifError(err);
				meta.configs.getFields(['someField1', 'someField2'], function (err, data) {
					assert.ifError(err);
					assert.equal(data.someField1, 'someValue1');
					assert.equal(data.someField2, 'someValue2');
					done();
				});
			});
		});

		it('should not set config if not empty', function (done) {
			meta.configs.setOnEmpty({ someField1: 'foo' }, function (err) {
				assert.ifError(err);
				meta.configs.get('someField1', function (err, value) {
					assert.ifError(err);
					assert.equal(value, 'someValue1');
					done();
				});
			});
		});

		it('should remove config field', function (done) {
			socketAdmin.config.remove({ uid: fooUid }, 'someField1', function (err) {
				assert.ifError(err);
				db.isObjectField('config', 'someField1', function (err, isObjectField) {
					assert.ifError(err);
					assert(!isObjectField);
					done();
				});
			});
		});
	});


	describe('session TTL', function () {
		it('should return 14 days in seconds', function (done) {
			assert(meta.getSessionTTLSeconds(), 1209600);
			done();
		});

		it('should return 7 days in seconds', function (done) {
			meta.config.loginDays = 7;
			assert(meta.getSessionTTLSeconds(), 604800);
			done();
		});

		it('should return 2 days in seconds', function (done) {
			meta.config.loginSeconds = 172800;
			assert(meta.getSessionTTLSeconds(), 172800);
			done();
		});
	});

	describe('dependencies', function () {
		it('should return ENOENT if module is not found', function (done) {
			meta.dependencies.checkModule('some-module-that-does-not-exist', function (err) {
				assert.equal(err.code, 'ENOENT');
				done();
			});
		});

		it('should not error if module is a nodebb-plugin-*', function (done) {
			meta.dependencies.checkModule('nodebb-plugin-somePlugin', function (err) {
				assert.ifError(err);
				done();
			});
		});

		it('should not error if module is nodebb-theme-*', function (done) {
			meta.dependencies.checkModule('nodebb-theme-someTheme', function (err) {
				assert.ifError(err);
				done();
			});
		});

		it('should parse json package data', function (done) {
			var pkgData = meta.dependencies.parseModuleData('nodebb-plugin-test', '{"a": 1}');
			assert.equal(pkgData.a, 1);
			done();
		});

		it('should return null data with invalid json', function (done) {
			var pkgData = meta.dependencies.parseModuleData('nodebb-plugin-test', 'asdasd');
			assert.strictEqual(pkgData, null);
			done();
		});

		it('should return false if moduleData is falsy', function (done) {
			assert(!meta.dependencies.doesSatisfy(null, '1.0.0'));
			done();
		});

		it('should return false if moduleData doesnt not satisfy package.json', function (done) {
			assert(!meta.dependencies.doesSatisfy({ name: 'nodebb-plugin-test', version: '0.9.0' }, '1.0.0'));
			done();
		});

		it('should return true if _resolved is from github', function (done) {
			assert(meta.dependencies.doesSatisfy({ name: 'nodebb-plugin-test', _resolved: 'https://github.com/some/repo', version: '0.9.0' }, '1.0.0'));
			done();
		});
	});


	describe('sounds', function () {
		var socketModules = require('../src/socket.io/modules');

		it('should getUserMap', function (done) {
			socketModules.sounds.getUserSoundMap({ uid: 1 }, null, function (err, data) {
				assert.ifError(err);
				assert(data.hasOwnProperty('chat-incoming'));
				assert(data.hasOwnProperty('chat-outgoing'));
				assert(data.hasOwnProperty('notification'));
				done();
			});
		});
	});

	describe('debugFork', function () {
		var oldArgv;
		before(function () {
			oldArgv = process.execArgv;
			process.execArgv = ['--debug=5858', '--foo=1'];
		});

		it('should detect debugging', function (done) {
			var debugFork = require('../src/meta/debugFork');
			assert(!debugFork.debugging);

			var debugForkPath = require.resolve('../src/meta/debugFork');
			delete require.cache[debugForkPath];

			debugFork = require('../src/meta/debugFork');
			assert(debugFork.debugging);

			done();
		});

		after(function () {
			process.execArgv = oldArgv;
		});
	});

	describe('Access-Control-Allow-Origin', function () {
		it('Access-Control-Allow-Origin header should be empty', function (done) {
			var jar = request.jar();
			request.get(nconf.get('url') + '/api/search?term=bug', {
				form: {},
				json: true,
				jar: jar,
			}, function (err, response, body) {
				assert.ifError(err);
				assert.equal(response.headers['access-control-allow-origin'], undefined);
				done();
			});
		});

		it('should set proper Access-Control-Allow-Origin header', function (done) {
			var jar = request.jar();
			var oldValue = meta.config['access-control-allow-origin'];
			meta.config['access-control-allow-origin'] = 'test.com, mydomain.com';
			request.get(nconf.get('url') + '/api/search?term=bug', {
				form: {
				},
				json: true,
				jar: jar,
				headers: {
					origin: 'mydomain.com',
				},
			}, function (err, response, body) {
				assert.ifError(err);
				assert.equal(response.headers['access-control-allow-origin'], 'mydomain.com');
				meta.config['access-control-allow-origin'] = oldValue;
				done(err);
			});
		});

		it('Access-Control-Allow-Origin header should be empty if origin does not match', function (done) {
			var jar = request.jar();
			var oldValue = meta.config['access-control-allow-origin'];
			meta.config['access-control-allow-origin'] = 'test.com, mydomain.com';
			request.get(nconf.get('url') + '/api/search?term=bug', {
				form: {
				},
				json: true,
				jar: jar,
				headers: {
					origin: 'notallowed.com',
				},
			}, function (err, response, body) {
				assert.ifError(err);
				assert.equal(response.headers['access-control-allow-origin'], undefined);
				meta.config['access-control-allow-origin'] = oldValue;
				done(err);
			});
		});

		it('should set proper Access-Control-Allow-Origin header', function (done) {
			var jar = request.jar();
			var oldValue = meta.config['access-control-allow-origin-regex'];
			meta.config['access-control-allow-origin-regex'] = 'match\\.this\\..+\\.domain.com, mydomain\\.com';
			request.get(nconf.get('url') + '/api/search?term=bug', {
				form: {
				},
				json: true,
				jar: jar,
				headers: {
					origin: 'match.this.anything123.domain.com',
				},
			}, function (err, response, body) {
				assert.ifError(err);
				assert.equal(response.headers['access-control-allow-origin'], 'match.this.anything123.domain.com');
				meta.config['access-control-allow-origin-regex'] = oldValue;
				done(err);
			});
		});

		it('Access-Control-Allow-Origin header should be empty if origin does not match', function (done) {
			var jar = request.jar();
			var oldValue = meta.config['access-control-allow-origin-regex'];
			meta.config['access-control-allow-origin-regex'] = 'match\\.this\\..+\\.domain.com, mydomain\\.com';
			request.get(nconf.get('url') + '/api/search?term=bug', {
				form: {
				},
				json: true,
				jar: jar,
				headers: {
					origin: 'notallowed.com',
				},
			}, function (err, response, body) {
				assert.ifError(err);
				assert.equal(response.headers['access-control-allow-origin'], undefined);
				meta.config['access-control-allow-origin-regex'] = oldValue;
				done(err);
			});
		});

		it('should not error with invalid regexp', function (done) {
			var jar = request.jar();
			var oldValue = meta.config['access-control-allow-origin-regex'];
			meta.config['access-control-allow-origin-regex'] = '[match\\.this\\..+\\.domain.com, mydomain\\.com';
			request.get(nconf.get('url') + '/api/search?term=bug', {
				form: {
				},
				json: true,
				jar: jar,
				headers: {
					origin: 'mydomain.com',
				},
			}, function (err, response, body) {
				assert.ifError(err);
				assert.equal(response.headers['access-control-allow-origin'], 'mydomain.com');
				meta.config['access-control-allow-origin-regex'] = oldValue;
				done(err);
			});
		});
	});
});
