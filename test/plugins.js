'use strict';


var	assert = require('assert');
var path = require('path');
var nconf = require('nconf');
var request = require('request');
var fs = require('fs');

var db = require('./mocks/databasemock');
var plugins = require('../src/plugins');

describe('Plugins', function () {
	it('should load plugin data', function (done) {
		var pluginId = 'nodebb-plugin-markdown';
		plugins.loadPlugin(path.join(nconf.get('base_dir'), 'node_modules/' + pluginId), function (err) {
			assert.ifError(err);
			assert(plugins.libraries[pluginId]);
			assert(plugins.loadedHooks['static:app.load']);

			done();
		});
	});

	it('should return true if hook has listeners', function (done) {
		assert(plugins.hasListeners('filter:parse.post'));
		done();
	});

	it('should register and fire a filter hook', function (done) {
		function filterMethod1(data, callback) {
			data.foo += 1;
			callback(null, data);
		}
		function filterMethod2(data, callback) {
			data.foo += 5;
			callback(null, data);
		}

		plugins.registerHook('test-plugin', { hook: 'filter:test.hook', method: filterMethod1 });
		plugins.registerHook('test-plugin', { hook: 'filter:test.hook', method: filterMethod2 });

		plugins.fireHook('filter:test.hook', { foo: 1 }, function (err, data) {
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

		plugins.registerHook('test-plugin', { hook: 'action:test.hook', method: actionMethod });
		plugins.fireHook('action:test.hook', { bar: 'test' });
	});

	it('should register and fire a static hook', function (done) {
		function actionMethod(data, callback) {
			assert.equal(data.bar, 'test');
			callback();
		}

		plugins.registerHook('test-plugin', { hook: 'static:test.hook', method: actionMethod });
		plugins.fireHook('static:test.hook', { bar: 'test' }, function (err) {
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

	it('should show installed plugins', function (done) {
		var nodeModulesPath = plugins.nodeModulesPath;
		plugins.nodeModulesPath = path.join(__dirname, './mocks/plugin_modules');

		plugins.showInstalled(function (err, pluginsData) {
			assert.ifError(err);
			var paths = pluginsData.map(function (plugin) {
				return path.relative(plugins.nodeModulesPath, plugin.path).replace(/\\/g, '/');
			});
			assert(paths.indexOf('nodebb-plugin-xyz') > -1);
			assert(paths.indexOf('@nodebb/nodebb-plugin-abc') > -1);

			plugins.nodeModulesPath = nodeModulesPath;
			done();
		});
	});

	describe('install/activate/uninstall', function () {
		var latest;
		var pluginName = 'nodebb-plugin-imgur';
		it('should install a plugin', function (done) {
			this.timeout(0);
			plugins.toggleInstall(pluginName, '1.0.16', function (err, pluginData) {
				assert.ifError(err);
				latest = pluginData.latest;

				assert.equal(pluginData.name, pluginName);
				assert.equal(pluginData.id, pluginName);
				assert.equal(pluginData.url, 'https://github.com/barisusakli/nodebb-plugin-imgur#readme');
				assert.equal(pluginData.description, 'A Plugin that uploads images to imgur');
				assert.equal(pluginData.active, false);
				assert.equal(pluginData.installed, true);

				var packageFile = JSON.parse(fs.readFileSync(path.join(__dirname, '../package.json'), 'utf8'));
				assert(packageFile.dependencies[pluginName]);

				done();
			});
		});

		it('should activate plugin', function (done) {
			plugins.toggleActive(pluginName, function (err) {
				assert.ifError(err);
				plugins.isActive(pluginName, function (err, isActive) {
					assert.ifError(err);
					assert(isActive);
					done();
				});
			});
		});

		it('should upgrade plugin', function (done) {
			this.timeout(0);
			plugins.upgrade(pluginName, 'latest', function (err, isActive) {
				assert.ifError(err);
				assert(isActive);
				plugins.loadPluginInfo(path.join(nconf.get('base_dir'), 'node_modules', pluginName), function (err, pluginInfo) {
					assert.ifError(err);
					assert.equal(pluginInfo.version, latest);
					done();
				});
			});
		});

		it('should uninstall a plugin', function (done) {
			this.timeout(0);
			plugins.toggleInstall(pluginName, 'latest', function (err, pluginData) {
				assert.ifError(err);
				assert.equal(pluginData.installed, false);
				assert.equal(pluginData.active, false);

				var packageFile = JSON.parse(fs.readFileSync(path.join(__dirname, '../package.json'), 'utf8'));
				assert(!packageFile.dependencies[pluginName]);

				done();
			});
		});
	});

	describe('static assets', function () {
		it('should 404 if resource does not exist', function (done) {
			request.get(nconf.get('url') + '/plugins/doesnotexist/should404.tpl', function (err, res, body) {
				assert.ifError(err);
				assert.equal(res.statusCode, 404);
				assert(body);
				done();
			});
		});

		it('should 404 if resource does not exist', function (done) {
			request.get(nconf.get('url') + '/plugins/nodebb-plugin-dbsearch/dbsearch/templates/admin/plugins/should404.tpl', function (err, res, body) {
				assert.ifError(err);
				assert.equal(res.statusCode, 404);
				assert(body);
				done();
			});
		});

		it('should get resource', function (done) {
			request.get(nconf.get('url') + '/plugins/nodebb-plugin-dbsearch/dbsearch/templates/admin/plugins/dbsearch.tpl', function (err, res, body) {
				assert.ifError(err);
				assert.equal(res.statusCode, 200);
				assert(body);
				done();
			});
		});
	});
});
