'use strict';

var winston = require('winston'),
	fork = require('child_process').fork,
	path = require('path'),
	async = require('async'),
	_ = require('underscore'),
	os = require('os'),
	nconf = require('nconf'),
	cluster = require('cluster'),
	fs = require('fs'),

	plugins = require('../plugins'),
	emitter = require('../emitter'),
	utils = require('../../public/src/utils');

module.exports = function(Meta) {

	Meta.js = {
		cache: '',
		map: '',
		hash: +new Date(),
		prepared: false,
		minFile: 'nodebb.min.js',
		scripts: {
			base: [
				'public/vendor/jquery/js/jquery.js',
				'public/vendor/jquery/js/jquery-ui-1.10.4.custom.js',
				'./node_modules/socket.io-client/dist/socket.io.js',
				'public/vendor/jquery/timeago/jquery.timeago.min.js',
				'public/vendor/jquery/js/jquery.form.min.js',
				'public/vendor/visibility/visibility.min.js',
				'public/vendor/bootstrap/js/bootstrap.min.js',
				'public/vendor/jquery/bootstrap-tagsinput/bootstrap-tagsinput.min.js',
				'public/vendor/requirejs/require.js',
				'public/vendor/bootbox/bootbox.min.js',
				'public/vendor/tinycon/tinycon.js',
				'public/vendor/xregexp/xregexp.js',
				'public/vendor/xregexp/unicode/unicode-base.js',
				'public/vendor/buzz/buzz.min.js',
				'public/vendor/mousetrap/mousetrap.js',
				'./node_modules/templates.js/lib/templates.js',
				'public/src/utils.js',
				'public/src/app.js',
				'public/src/ajaxify.js',
				'public/src/variables.js',
				'public/src/widgets.js',
				'public/src/translator.js',
				'public/src/helpers.js',
				'public/src/overrides.js'
			]
		}
	};

	Meta.js.loadRJS = function(callback) {
		var rjsPath = path.join(__dirname, '../../public/src');

		async.parallel({
			client: function(next) {
				utils.walk(path.join(rjsPath, 'client'), next);
			},
			modules: function(next) {
				utils.walk(path.join(rjsPath, 'modules'), next);
			}
		}, function(err, rjsFiles) {
			if (err) {
				return callback(err);
			}
			rjsFiles = rjsFiles.client.concat(rjsFiles.modules);

			rjsFiles = rjsFiles.map(function(file) {
				return path.join('public/src', file.replace(rjsPath, ''));
			});

			Meta.js.scripts.rjs = rjsFiles;

			callback();
		});
	};

	Meta.js.prepare = function (callback) {
		async.parallel([
			async.apply(Meta.js.loadRJS),	// Require.js scripts
			async.apply(getPluginScripts),	// plugin scripts via filter:scripts.get
			function(next) {	// client scripts via "scripts" config in plugin.json
				var pluginsScripts = [],
					pluginDirectories = [],
					clientScripts = [];

				pluginsScripts = plugins.clientScripts.filter(function(path) {
					if (path.indexOf('.js') !== -1) {
						return true;
					} else {
						pluginDirectories.push(path);
						return false;
					}
				});

				// Add plugin scripts
				Meta.js.scripts.client = pluginsScripts;

				// Add plugin script directories
				async.each(pluginDirectories, function(directory, next) {
					utils.walk(directory, function(err, scripts) {
						Meta.js.scripts.client = Meta.js.scripts.client.concat(scripts);
						next(err);
					});
				}, next);
			}
		], function(err) {
			if (err) {
				return callback(err);
			}

			// Convert all scripts to paths relative to the NodeBB base directory
			var basePath = path.resolve(__dirname, '../..');
			Meta.js.scripts.all = Meta.js.scripts.base.concat(Meta.js.scripts.rjs, Meta.js.scripts.plugin, Meta.js.scripts.client).map(function(script) {
				return path.relative(basePath, script).replace(/\\/g, '/');
			});
			callback();
		});
	};

	Meta.js.minify = function(minify, callback) {
		if (!cluster.isWorker || process.env.cluster_setup === 'true') {
			var minifier = Meta.js.minifierProc = fork('minifier.js'),
				onComplete = function(err) {
					if (err) {
						winston.error('[meta/js] Minification failed: ' + err.message);
						process.exit(0);
					}

					winston.info('[meta/js] Minification complete');
					minifier.kill();

					if (cluster.isWorker) {
						process.send({
							action: 'js-propagate',
							cache: Meta.js.cache,
							map: Meta.js.map
						});
					}

					Meta.js.commitToFile();

					if (typeof callback === 'function') {
						callback();
					}
				};

			minifier.on('message', function(message) {
				switch(message.type) {
				case 'end':
					Meta.js.cache = message.data.js;
					Meta.js.map = message.data.map;

					onComplete();

					break;
				case 'hash':
					Meta.js.hash = message.payload;
					break;
				case 'error':
					winston.error('[meta/js] Could not compile client-side scripts! ' + message.payload.message);
					minifier.kill();
					if (typeof callback === 'function') {
						callback(new Error(message.payload.message));
					} else {
						process.exit(0);
					}
					break;
				}
			});

			Meta.js.prepare(function() {
				minifier.send({
					action: 'js',
					relativePath: nconf.get('url') + '/',
					minify: minify,
					scripts: Meta.js.scripts.all
				});
			});
		} else {
			if (typeof callback === 'function') {
				callback();
			}
		}
	};

	Meta.js.killMinifier = function(callback) {
		if (Meta.js.minifierProc) {
			Meta.js.minifierProc.kill('SIGTERM');
		}
	};

	Meta.js.commitToFile = function() {
		async.parallel([
			async.apply(fs.writeFile, path.join(__dirname, '../../public/nodebb.min.js'), Meta.js.cache),
			async.apply(fs.writeFile, path.join(__dirname, '../../public/nodebb.min.js.map'), Meta.js.map)
		], function (err) {
			if (!err) {
				winston.info('[meta/js] Client-side minfile and mapping committed to disk.');
				emitter.emit('meta:js.compiled');
			} else {
				winston.error('[meta/js] ' + err.message);
				process.exit(0);
			}
		});
	};

	function getPluginScripts(callback) {
		plugins.fireHook('filter:scripts.get', [], function(err, scripts) {
			if (err) {
				callback(err, []);
			}

			var jsPaths = scripts.map(function (jsPath) {
					jsPath = path.normalize(jsPath);

					var	matches = _.map(plugins.staticDirs, function(realPath, mappedPath) {
						if (jsPath.match(mappedPath)) {
							return mappedPath;
						} else {
							return null;
						}
					}).filter(function(a) { return a; });

					if (matches.length) {
						var	relPath = jsPath.slice(('plugins/' + matches[0]).length),
							pluginId = matches[0].split(path.sep)[0];

						return plugins.staticDirs[matches[0]] + relPath;
					} else {
						winston.warn('[meta.scripts.get] Could not resolve mapped path: ' + jsPath + '. Are you sure it is defined by a plugin?');
						return null;
					}
				});

			Meta.js.scripts.plugin = jsPaths.filter(Boolean);
			callback();
		});
	}
};