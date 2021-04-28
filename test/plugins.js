'use strict';


const	assert = require('assert');
const path = require('path');
const nconf = require('nconf');
const request = require('request');
const fs = require('fs');

const db = require('./mocks/databasemock');
const plugins = require('../src/plugins');

describe('Plugins', () => {
	it('should load plugin data', (done) => {
		const pluginId = 'nodebb-plugin-markdown';
		plugins.loadPlugin(path.join(nconf.get('base_dir'), `node_modules/${pluginId}`), (err) => {
			assert.ifError(err);
			assert(plugins.libraries[pluginId]);
			assert(plugins.loadedHooks['static:app.load']);

			done();
		});
	});

	it('should return true if hook has listeners', (done) => {
		assert(plugins.hooks.hasListeners('filter:parse.post'));
		done();
	});

	it('should register and fire a filter hook', (done) => {
		function filterMethod1(data, callback) {
			data.foo += 1;
			callback(null, data);
		}
		function filterMethod2(data, callback) {
			data.foo += 5;
			callback(null, data);
		}

		plugins.hooks.register('test-plugin', { hook: 'filter:test.hook', method: filterMethod1 });
		plugins.hooks.register('test-plugin', { hook: 'filter:test.hook', method: filterMethod2 });

		plugins.hooks.fire('filter:test.hook', { foo: 1 }, (err, data) => {
			assert.ifError(err);
			assert.equal(data.foo, 7);
			done();
		});
	});

	it('should register and fire a filter hook having 3 methods, one returning a promise, one calling the callback and one just returning', async () => {
		function method1(data, callback) {
			data.foo += 1;
			callback(null, data);
		}
		async function method2(data) {
			return new Promise((resolve) => {
				data.foo += 5;
				resolve(data);
			});
		}
		function method3(data) {
			data.foo += 1;
			return data;
		}

		plugins.hooks.register('test-plugin', { hook: 'filter:test.hook2', method: method1 });
		plugins.hooks.register('test-plugin', { hook: 'filter:test.hook2', method: method2 });
		plugins.hooks.register('test-plugin', { hook: 'filter:test.hook2', method: method3 });

		const data = await plugins.hooks.fire('filter:test.hook2', { foo: 1 });
		assert.strictEqual(data.foo, 8);
	});

	it('should register and fire a filter hook that returns a promise that gets rejected', (done) => {
		async function method(data) {
			return new Promise((resolve, reject) => {
				data.foo += 5;
				reject(new Error('nope'));
			});
		}
		plugins.hooks.register('test-plugin', { hook: 'filter:test.hook3', method: method });
		plugins.hooks.fire('filter:test.hook3', { foo: 1 }, (err) => {
			assert(err);
			done();
		});
	});

	it('should register and fire an action hook', (done) => {
		function actionMethod(data) {
			assert.equal(data.bar, 'test');
			done();
		}

		plugins.hooks.register('test-plugin', { hook: 'action:test.hook', method: actionMethod });
		plugins.hooks.fire('action:test.hook', { bar: 'test' });
	});

	it('should register and fire a static hook', (done) => {
		function actionMethod(data, callback) {
			assert.equal(data.bar, 'test');
			callback();
		}

		plugins.hooks.register('test-plugin', { hook: 'static:test.hook', method: actionMethod });
		plugins.hooks.fire('static:test.hook', { bar: 'test' }, (err) => {
			assert.ifError(err);
			done();
		});
	});

	it('should register and fire a static hook returning a promise', (done) => {
		async function method(data) {
			assert.equal(data.bar, 'test');
			return new Promise((resolve) => {
				resolve();
			});
		}
		plugins.hooks.register('test-plugin', { hook: 'static:test.hook', method: method });
		plugins.hooks.fire('static:test.hook', { bar: 'test' }, (err) => {
			assert.ifError(err);
			done();
		});
	});

	it('should register and fire a static hook returning a promise that gets rejected with a error', (done) => {
		async function method(data) {
			assert.equal(data.bar, 'test');
			return new Promise((resolve, reject) => {
				reject(new Error('just because'));
			});
		}
		plugins.hooks.register('test-plugin', { hook: 'static:test.hook', method: method });
		plugins.hooks.fire('static:test.hook', { bar: 'test' }, (err) => {
			assert.strictEqual(err.message, 'just because');
			plugins.hooks.unregister('test-plugin', 'static:test.hook', method);
			done();
		});
	});

	it('should register and timeout a static hook returning a promise but takes too long', (done) => {
		async function method(data) {
			assert.equal(data.bar, 'test');
			return new Promise((resolve) => {
				setTimeout(resolve, 6000);
			});
		}
		plugins.hooks.register('test-plugin', { hook: 'static:test.hook', method: method });
		plugins.hooks.fire('static:test.hook', { bar: 'test' }, (err) => {
			assert.ifError(err);
			plugins.hooks.unregister('test-plugin', 'static:test.hook', method);
			done();
		});
	});

	it('should get plugin data from nbbpm', (done) => {
		plugins.get('nodebb-plugin-markdown', (err, data) => {
			assert.ifError(err);
			const keys = ['id', 'name', 'url', 'description', 'latest', 'installed', 'active', 'latest'];
			assert.equal(data.name, 'nodebb-plugin-markdown');
			assert.equal(data.id, 'nodebb-plugin-markdown');
			keys.forEach((key) => {
				assert(data.hasOwnProperty(key));
			});
			done();
		});
	});

	it('should get a list of plugins', (done) => {
		plugins.list((err, data) => {
			assert.ifError(err);
			const keys = ['id', 'name', 'url', 'description', 'latest', 'installed', 'active', 'latest'];
			assert(Array.isArray(data));
			keys.forEach((key) => {
				assert(data[0].hasOwnProperty(key));
			});
			done();
		});
	});

	it('should show installed plugins', (done) => {
		const { nodeModulesPath } = plugins;
		plugins.nodeModulesPath = path.join(__dirname, './mocks/plugin_modules');

		plugins.showInstalled((err, pluginsData) => {
			assert.ifError(err);
			const paths = pluginsData.map(plugin => path.relative(plugins.nodeModulesPath, plugin.path).replace(/\\/g, '/'));
			assert(paths.indexOf('nodebb-plugin-xyz') > -1);
			assert(paths.indexOf('@nodebb/nodebb-plugin-abc') > -1);

			plugins.nodeModulesPath = nodeModulesPath;
			done();
		});
	});

	describe('install/activate/uninstall', () => {
		let latest;
		const pluginName = 'nodebb-plugin-imgur';
		it('should install a plugin', function (done) {
			this.timeout(0);
			plugins.toggleInstall(pluginName, '1.0.16', (err, pluginData) => {
				assert.ifError(err);
				latest = pluginData.latest;

				assert.equal(pluginData.name, pluginName);
				assert.equal(pluginData.id, pluginName);
				assert.equal(pluginData.url, 'https://github.com/barisusakli/nodebb-plugin-imgur#readme');
				assert.equal(pluginData.description, 'A Plugin that uploads images to imgur');
				assert.equal(pluginData.active, false);
				assert.equal(pluginData.installed, true);

				const packageFile = JSON.parse(fs.readFileSync(path.join(__dirname, '../package.json'), 'utf8'));
				assert(packageFile.dependencies[pluginName]);

				done();
			});
		});

		it('should activate plugin', (done) => {
			plugins.toggleActive(pluginName, (err) => {
				assert.ifError(err);
				plugins.isActive(pluginName, (err, isActive) => {
					assert.ifError(err);
					assert(isActive);
					done();
				});
			});
		});

		it('should upgrade plugin', function (done) {
			this.timeout(0);
			plugins.upgrade(pluginName, 'latest', (err, isActive) => {
				assert.ifError(err);
				assert(isActive);
				plugins.loadPluginInfo(path.join(nconf.get('base_dir'), 'node_modules', pluginName), (err, pluginInfo) => {
					assert.ifError(err);
					assert.equal(pluginInfo.version, latest);
					done();
				});
			});
		});

		it('should uninstall a plugin', function (done) {
			this.timeout(0);
			plugins.toggleInstall(pluginName, 'latest', (err, pluginData) => {
				assert.ifError(err);
				assert.equal(pluginData.installed, false);
				assert.equal(pluginData.active, false);

				const packageFile = JSON.parse(fs.readFileSync(path.join(__dirname, '../package.json'), 'utf8'));
				assert(!packageFile.dependencies[pluginName]);

				done();
			});
		});
	});

	describe('static assets', () => {
		it('should 404 if resource does not exist', (done) => {
			request.get(`${nconf.get('url')}/plugins/doesnotexist/should404.tpl`, (err, res, body) => {
				assert.ifError(err);
				assert.equal(res.statusCode, 404);
				assert(body);
				done();
			});
		});

		it('should 404 if resource does not exist', (done) => {
			request.get(`${nconf.get('url')}/plugins/nodebb-plugin-dbsearch/dbsearch/templates/admin/plugins/should404.tpl`, (err, res, body) => {
				assert.ifError(err);
				assert.equal(res.statusCode, 404);
				assert(body);
				done();
			});
		});

		it('should get resource', (done) => {
			request.get(`${nconf.get('url')}/plugins/nodebb-plugin-dbsearch/dbsearch/templates/admin/plugins/dbsearch.tpl`, (err, res, body) => {
				assert.ifError(err);
				assert.equal(res.statusCode, 200);
				assert(body);
				done();
			});
		});
	});
});
