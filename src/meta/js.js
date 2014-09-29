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
				'public/vendor/jquery/serializeObject/jquery.ba-serializeobject.min.js',
				'public/vendor/jquery/deserialize/jquery.deserialize.min.js',
				'public/vendor/bootstrap/js/bootstrap.min.js',
				'public/vendor/jquery/bootstrap-tagsinput/bootstrap-tagsinput.min.js',
				'public/vendor/requirejs/require.js',
				'public/vendor/bootbox/bootbox.min.js',
				'public/vendor/tinycon/tinycon.js',
				'public/vendor/xregexp/xregexp.js',
				'public/vendor/xregexp/unicode/unicode-base.js',
				'public/vendor/buzz/buzz.min.js',
				'public/vendor/mousetrap/mousetrap.js',
				'public/vendor/semver/semver.browser.js',
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
			if (err) return callback(err);

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
			var minifier = Meta.js.minifierProc = fork('minifier.js', {
					silent: true
				}),
				minifiedStream = minifier.stdio[1],
				minifiedString = '',
				mapStream = minifier.stdio[2],
				mapString = '',
				step = 0,
				onComplete = function() {
					if (step === 0) {
						return step++;
					}

					Meta.js.cache = minifiedString;
					Meta.js.map = mapString;
					winston.info('[meta/js] Compilation complete');
					emitter.emit('meta:js.compiled');
					minifier.kill();

					if (cluster.isWorker) {
						process.send({
							action: 'js-propagate',
							cache: minifiedString,
							map: mapString
						});

						// Save the minfile in public/ so things like nginx can serve it
						Meta.js.commitToFile();
					}

					if (typeof callback === 'function') {
						callback();
					}
				};

			minifiedStream.on('data', function(buffer) {
				minifiedString += buffer.toString();
			});
			mapStream.on('data', function(buffer) {
				mapString += buffer.toString();
			});

			minifier.on('message', function(message) {
				switch(message.type) {
				case 'end':
					if (message.payload === 'script') {
						winston.info('[meta/js] Successfully minified.');
						onComplete();
					} else if (message.payload === 'mapping') {
						winston.info('[meta/js] Retrieved Mapping.');
						onComplete();
					}
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
		winston.info('[meta/js] Committing minfile to disk');
		async.parallel([
			async.apply(fs.writeFile, path.join(__dirname, '../../public/nodebb.min.js'), Meta.js.cache),
			async.apply(fs.writeFile, path.join(__dirname, '../../public/nodebb.min.js.map'), Meta.js.map)
		], function (err) {
			if (!err) {
				winston.info('[meta/js] Client-side minfile and mapping committed to disk.');
			} else {
				winston.error('[meta/js] ' + err.message);
				process.exit(0);
			}
		});
	};

	function getPluginScripts(callback) {
		plugins.fireHook('filter:scripts.get', [], function(err, scripts) {
			if (err) callback(err, []);

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
	};
};