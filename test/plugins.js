'use strict';

const assert = require('assert');
const path = require('path');
const nconf = require('nconf');

const fs = require('fs');

const db = require('./mocks/databasemock');
const plugins = require('../src/plugins');
const request = require('../src/request');

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

	it('should register and fire a filter hook having 3 methods', async () => {
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

	it('should not error with invalid hooks', async () => {
		function method1(data, callback) {
			data.foo += 1;
			return data;
		}
		function method2(data, callback) {
			data.foo += 2;
			// this is invalid
			callback(null, data);
			return data;
		}

		plugins.hooks.register('test-plugin', { hook: 'filter:test.hook3', method: method1 });
		plugins.hooks.register('test-plugin', { hook: 'filter:test.hook3', method: method2 });

		const data = await plugins.hooks.fire('filter:test.hook3', { foo: 1 });
		assert.strictEqual(data.foo, 4);
	});

	it('should register and fire a filter hook that returns a promise that gets rejected', (done) => {
		async function method(data) {
			return new Promise((resolve, reject) => {
				data.foo += 5;
				reject(new Error('nope'));
			});
		}
		plugins.hooks.register('test-plugin', { hook: 'filter:test.hook4', method: method });
		plugins.hooks.fire('filter:test.hook4', { foo: 1 }, (err) => {
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

	it('should submit usage info', (done) => {
		plugins.submitUsageData((err) => {
			assert.ifError(err);
			done();
		});
	});

	describe('install/activate/uninstall', () => {
		let latest;
		const pluginName = 'nodebb-plugin-imgur';
		const oldValue = process.env.NODE_ENV;
		before((done) => {
			process.env.NODE_ENV = 'development';
			done();
		});
		after((done) => {
			process.env.NODE_ENV = oldValue;
			done();
		});

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

		it('should error if plugin id is invalid', async () => {
			await assert.rejects(
				plugins.toggleActive('\t\nnodebb-plugin'),
				{ message: '[[error:invalid-plugin-id]]' }
			);

			await assert.rejects(
				plugins.toggleActive('notaplugin'),
				{ message: '[[error:invalid-plugin-id]]' }
			);
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
		it('should 404 if resource does not exist', async () => {
			const { response, body } = await request.get(`${nconf.get('url')}/plugins/doesnotexist/should404.tpl`);
			assert.equal(response.statusCode, 404);
			assert(body);
		});

		it('should 404 if resource does not exist', async () => {
			const url = `${nconf.get('url')}/plugins/nodebb-plugin-dbsearch/dbsearch/templates/admin/plugins/should404.tpl`;
			const { response, body } = await request.get(url);
			assert.equal(response.statusCode, 404);
			assert(body);
		});

		it('should get resource', async () => {
			const url = `${nconf.get('url')}/assets/templates/admin/plugins/dbsearch.tpl`;
			const { response, body } = await request.get(url);
			assert.equal(response.statusCode, 200);
			assert(body);
		});
	});

	describe('plugin state set in configuration', () => {
		const activePlugins = [
			'nodebb-plugin-markdown',
			'nodebb-plugin-mentions',
		];
		const inactivePlugin = 'nodebb-plugin-emoji';
		beforeEach((done) => {
			nconf.set('plugins:active', activePlugins);
			done();
		});
		afterEach((done) => {
			nconf.set('plugins:active', undefined);
			done();
		});

		it('should return active plugin state from configuration', (done) => {
			plugins.isActive(activePlugins[0], (err, isActive) => {
				assert.ifError(err);
				assert(isActive);
				done();
			});
		});

		it('should return inactive plugin state if not in configuration', (done) => {
			plugins.isActive(inactivePlugin, (err, isActive) => {
				assert.ifError(err);
				assert(!isActive);
				done();
			});
		});

		it('should get a list of plugins from configuration', (done) => {
			plugins.list((err, data) => {
				assert.ifError(err);
				const keys = ['id', 'name', 'url', 'description', 'latest', 'installed', 'active', 'latest'];
				assert(Array.isArray(data));
				keys.forEach((key) => {
					assert(data[0].hasOwnProperty(key));
				});
				data.forEach((pluginData) => {
					assert.equal(pluginData.active, activePlugins.includes(pluginData.id));
				});
				done();
			});
		});

		it('should return a list of only active plugins from configuration', (done) => {
			plugins.getActive((err, data) => {
				assert.ifError(err);
				assert(Array.isArray(data));
				data.forEach((pluginData) => {
					assert(activePlugins.includes(pluginData));
				});
				done();
			});
		});

		it('should not deactivate a plugin if active plugins are set in configuration', (done) => {
			assert.rejects(plugins.toggleActive(activePlugins[0]), Error).then(() => {
				plugins.isActive(activePlugins[0], (err, isActive) => {
					assert.ifError(err);
					assert(isActive);
					done();
				});
			});
		});

		it('should not activate a plugin if active plugins are set in configuration', (done) => {
			assert.rejects(plugins.toggleActive(inactivePlugin), Error).then(() => {
				plugins.isActive(inactivePlugin, (err, isActive) => {
					assert.ifError(err);
					assert(!isActive);
					done();
				});
			});
		});
	});
});


