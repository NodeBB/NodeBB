'use strict';

var winston = require('winston'),
	fork = require('child_process').fork,
	path = require('path'),
	async = require('async'),
	_ = require('underscore'),
	os = require('os'),

	plugins = require('../plugins'),
	emitter = require('../emitter'),
	utils = require('../../public/src/utils');

module.exports = function(Meta) {

	Meta.js = {
		cache: undefined,
		prepared: false,
		minFile: 'nodebb.min.js',
		scripts: [
			'vendor/jquery/js/jquery.js',
			'vendor/jquery/js/jquery-ui-1.10.4.custom.js',
			'vendor/jquery/timeago/jquery.timeago.min.js',
			'vendor/jquery/js/jquery.form.min.js',
			'vendor/jquery/serializeObject/jquery.ba-serializeobject.min.js',
			'vendor/jquery/deserialize/jquery.deserialize.min.js',
			'vendor/bootstrap/js/bootstrap.min.js',
			'vendor/jquery/bootstrap-tagsinput/bootstrap-tagsinput.min.js',
			'vendor/requirejs/require.js',
			'vendor/bootbox/bootbox.min.js',
			'vendor/tinycon/tinycon.js',
			'vendor/xregexp/xregexp.js',
			'vendor/xregexp/unicode/unicode-base.js',
			'vendor/buzz/buzz.min.js',
			'../node_modules/templates.js/lib/templates.js',
			'src/utils.js',
			'src/app.js',
			'src/ajaxify.js',
			'src/variables.js',
			'src/widgets.js',
			'src/translator.js',
			'src/helpers.js',
			'src/overrides.js'
		]
	};

	Meta.js.loadRJS = function(callback) {
		var rjsPath = path.join(__dirname, '../..', '/public/src');

		async.parallel({
			forum: function(next) {
				utils.walk(path.join(rjsPath, 'forum'), next);
			},
			modules: function(next) {
				utils.walk(path.join(rjsPath, 'modules'), next);
			}
		}, function(err, rjsFiles) {
			if (err) {
				return callback(err);
			}
			rjsFiles = rjsFiles.forum.concat(rjsFiles.modules);

			rjsFiles = rjsFiles.filter(function(file) {
				return file.match('admin') === null;
			}).map(function(file) {
				return path.join('src', file.replace(rjsPath, ''));
			});

			Meta.js.scripts = Meta.js.scripts.concat(rjsFiles);

			callback();
		});
	};

	Meta.js.prepare = function (callback) {
		plugins.fireHook('filter:scripts.get', Meta.js.scripts, function(err, scripts) {
			var jsPaths = scripts.map(function (jsPath) {
					jsPath = path.normalize(jsPath);

					if (jsPath.substring(0, 7) === 'plugins') {
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
					} else {
						return path.join(__dirname, '../..', '/public', jsPath);
					}
				});

			Meta.js.scripts = jsPaths.filter(function(path) {
				return path !== null;
			});

			var pluginDirectories = [];

			plugins.clientScripts = plugins.clientScripts.filter(function(path) {
				if (path.indexOf('.js') !== -1) {
					return true;
				} else {
					pluginDirectories.push(path);
					return false;
				}
			});

			// Add plugin scripts
			Meta.js.scripts = Meta.js.scripts.concat(plugins.clientScripts);

			async.each(pluginDirectories, function(directory, next) {
				utils.walk(directory, function(err, scripts) {
					Meta.js.scripts = Meta.js.scripts.concat(scripts);
					next(err);
				});
			}, function(err) {
				// Translate into relative paths
				Meta.js.scripts = Meta.js.scripts.map(function(script) {
					return path.relative(path.resolve(__dirname, '../..'), script).replace(/\\/g, '/');
				});

				Meta.js.prepared = true;
				callback(err);
			});
		});
	};

	Meta.js.minify = function(minify) {
		var minifier = Meta.js.minifierProc = fork('minifier.js');

		minifier.on('message', function(payload) {
			if (payload.action !== 'error') {
				winston.info('[meta/js] Compilation complete');
				Meta.js.cache = payload.data.js;
				Meta.js.map = payload.data.map;
				minifier.kill();

				emitter.emit('meta:js.compiled');
			} else {
				winston.error('[meta/js] Could not compile client-side scripts! ' + payload.error.message);
				minifier.kill();
				process.exit();
			}
		});

		Meta.js.loadRJS(function() {
			Meta.js.prepare(function() {
				minifier.send({
					action: 'js',
					minify: minify,
					scripts: Meta.js.scripts
				});
			});
		});
	};

	Meta.js.killMinifier = function(callback) {
		if (Meta.js.minifierProc) {
			Meta.js.minifierProc.kill('SIGTERM');
		}
	};

	// OS detection and handling
	// if (os.platform() === 'win32') {
	// 	Meta.js.scripts = Meta.js.scripts.map(function(script) {
	// 		return script.replace(/\//g, '\\');
	// 	});
	// }
};