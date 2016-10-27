'use strict';
/*global require*/

var	assert = require('assert');
var path = require('path');
var nconf = require('nconf');

var db = require('./mocks/databasemock');
var plugins = require('../src/plugins');

describe('Plugins', function () {

	it('should load plugin data', function (done) {
		var pluginId = 'nodebb-plugin-markdown';
		plugins.loadPlugin(path.join(nconf.get('base_dir'), 'node_modules/' + pluginId), function (err) {
			assert.ifError(err);
			assert(plugins.libraries[pluginId]);
			assert(plugins.loadedHooks['static:app.load']);
			assert(plugins.staticDirs['nodebb-plugin-markdown/js']);

			done();
		});
	});

	it('should return true if hook has listeners', function (done) {
		assert(plugins.hasListeners('filter:parse.post'));
		done();
	});

	it('should register and fire a filter hook', function (done) {
		function filterMethod1(data, callback) {
			data.foo ++;
			callback(null, data);
		}
		function filterMethod2(data, callback) {
			data.foo += 5;
			callback(null, data);
		}

		plugins.registerHook('test-plugin', {hook: 'filter:test.hook', method: filterMethod1});
		plugins.registerHook('test-plugin', {hook: 'filter:test.hook', method: filterMethod2});

		plugins.fireHook('filter:test.hook', {foo: 1}, function (err, data) {
			assert.ifError(err);
			assert.equal(data.foo, 7);
			done();
		});

	});

	it('should register and fire an action hook', function (done) {
		function actionMethod(data) {
			assert.equal(data.bar, 'test');
			done();
		}

		plugins.registerHook('test-plugin', {hook: 'action:test.hook', method: actionMethod});
		plugins.fireHook('action:test.hook', {bar: 'test'});
	});

	it('should register and fire a static hook', function (done) {
		function actionMethod(data, callback) {
			assert.equal(data.bar, 'test');
			callback();
		}

		plugins.registerHook('test-plugin', {hook: 'static:test.hook', method: actionMethod});
		plugins.fireHook('static:test.hook', {bar: 'test'}, function (err) {
			assert.ifError(err);
			done();
		});
	});

	it('should get plugin data from nbbpm', function (done) {
		plugins.get('nodebb-plugin-markdown', function (err, data) {
			assert.ifError(err);
			var keys = ['id', 'name', 'url', 'description', 'latest', 'installed', 'active', 'latest'];
			assert.equal(data.name, 'nodebb-plugin-markdown');
			assert.equal(data.id, 'nodebb-plugin-markdown');
			keys.forEach(function (key) {
				assert(data.hasOwnProperty(key));
			});
			done();
		});
	});

	it('should get a list of plugins', function (done) {
		plugins.list(function (err, data) {
			assert.ifError(err);
			var keys = ['id', 'name', 'url', 'description', 'latest', 'installed', 'active', 'latest'];
			assert(Array.isArray(data));
			keys.forEach(function (key) {
				assert(data[0].hasOwnProperty(key));
			});
			done();
		});
	});

});

