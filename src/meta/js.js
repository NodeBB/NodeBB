'use strict';

var winston = require('winston');
var fork = require('child_process').fork;
var path = require('path');
var async = require('async');
var fs = require('fs');
var mkdirp = require('mkdirp');
var rimraf = require('rimraf');

var file = require('../file');
var plugins = require('../plugins');
var utils = require('../../public/src/utils');

module.exports = function (Meta) {

	Meta.js = {
		target: {},
		scripts: {
			base: [
				'./node_modules/jquery/dist/jquery.js',
				'./node_modules/socket.io-client/dist/socket.io.js',
				'public/vendor/jquery/timeago/jquery.timeago.js',
				'public/vendor/jquery/js/jquery.form.min.js',
				'public/vendor/visibility/visibility.min.js',
				'public/vendor/bootstrap/js/bootstrap.js',
				'public/vendor/jquery/bootstrap-tagsinput/bootstrap-tagsinput.min.js',
				'public/vendor/jquery/textcomplete/jquery.textcomplete.js',
				'public/vendor/requirejs/require.js',
				'public/src/require-config.js',
				'public/vendor/bootbox/bootbox.js',
				'public/vendor/bootbox/wrapper.js',
				'public/vendor/tinycon/tinycon.js',
				'public/vendor/xregexp/xregexp.js',
				'public/vendor/xregexp/unicode/unicode-base.js',
				'./node_modules/templates.js/lib/templates.js',
				'public/src/utils.js',
				'public/src/sockets.js',
				'public/src/app.js',
				'public/src/ajaxify.js',
				'public/src/overrides.js',
				'public/src/widgets.js',
				"./node_modules/promise-polyfill/promise.js",
			],

			// files listed below are only available client-side, or are bundled in to reduce # of network requests on cold load
			rjs: [
				'public/src/client/footer.js',
				'public/src/client/chats.js',
				'public/src/client/infinitescroll.js',
				'public/src/client/pagination.js',
				'public/src/client/recent.js',
				'public/src/client/unread.js',
				'public/src/client/topic.js',
				'public/src/client/topic/events.js',
				'public/src/client/topic/flag.js',
				'public/src/client/topic/fork.js',
				'public/src/client/topic/move.js',
				'public/src/client/topic/posts.js',
				'public/src/client/topic/postTools.js',
				'public/src/client/topic/threadTools.js',
				'public/src/client/categories.js',
				'public/src/client/category.js',
				'public/src/client/category/tools.js',

				'public/src/modules/translator.js',
				'public/src/modules/notifications.js',
				'public/src/modules/chat.js',
				'public/src/modules/components.js',
				'public/src/modules/sort.js',
				'public/src/modules/navigator.js',
				'public/src/modules/topicSelect.js',
				'public/src/modules/share.js',
				'public/src/modules/search.js',
				'public/src/modules/alerts.js',
				'public/src/modules/taskbar.js',
				'public/src/modules/helpers.js',
				'public/src/modules/sounds.js',
				'public/src/modules/string.js',
			],

			// modules listed below are routed through express (/src/modules) so they can be defined anonymously
			modules: {
				"Chart.js": './node_modules/chart.js/dist/Chart.min.js',
				"mousetrap.js": './node_modules/mousetrap/mousetrap.min.js',
				"jqueryui.js": 'public/vendor/jquery/js/jquery-ui.js',
				"buzz.js": 'public/vendor/buzz/buzz.js',
				"cropper.js": './node_modules/cropperjs/dist/cropper.min.js',
			},
		},
	};

	Meta.js.linkModules = function (callback) {
		rimraf(path.join(__dirname, '../../build/public/src/modules'), function (err) {
			if (err) {
				return callback(err);
			}
			async.eachLimit(Object.keys(Meta.js.scripts.modules), 1000, function (relPath, next) {
				var filePath = path.join(__dirname, '../../', Meta.js.scripts.modules[relPath]);
				var destPath = path.join(__dirname, '../../build/public/src/modules', relPath);

				mkdirp(path.dirname(destPath), function (err) {
					if (err) {
						return next(err);
					}

					file.link(filePath, destPath, next);
				});
			}, callback);
		});
	};

	Meta.js.linkStatics = function (callback) {
		rimraf(path.join(__dirname, '../../build/public/plugins'), function (err) {
			if (err) {
				return callback(err);
			}
			async.eachLimit(Object.keys(plugins.staticDirs), 1000, function (mappedPath, next) {
				var sourceDir = plugins.staticDirs[mappedPath];
				var destDir = path.join(__dirname, '../../build/public/plugins', mappedPath);

				mkdirp(path.dirname(destDir), function (err) {
					if (err) {
						return next(err);
					}

					file.linkDirs(sourceDir, destDir, next);
				});
			}, callback);
		});
	};

	Meta.js.minify = function (target, callback) {
		winston.verbose('[meta/js] Minifying ' + target);

		var forkProcessParams = setupDebugging();
		var minifier = Meta.js.minifierProc = fork('minifier.js', [], forkProcessParams);

		Meta.js.target[target] = {};

		Meta.js.prepare(target, function (err) {
			if (err) {
				return callback(err);
			}
			minifier.send({
				action: 'js',
				minify: global.env !== 'development',
				scripts: Meta.js.target[target].scripts,
			});
		});

		minifier.on('message', function (message) {
			switch(message.type) {
			case 'end':
				Meta.js.target[target].cache = message.minified;
				Meta.js.target[target].map = message.sourceMap;
				winston.verbose('[meta/js] ' + target + ' minification complete');
				minifier.kill();

				Meta.js.commitToFile(target, callback);
				break;
			case 'error':
				winston.error('[meta/js] Could not compile ' + target + ': ' + message.message);
				minifier.kill();

				callback(new Error(message.message));
				break;
			}
		});
	};

	Meta.js.prepare = function (target, callback) {
		var pluginsScripts = [];

		var pluginDirectories = [];

		pluginsScripts = plugins[target === 'nodebb.min.js' ? 'clientScripts' : 'acpScripts'].filter(function (path) {
			if (path.endsWith('.js')) {
				return true;
			}

			pluginDirectories.push(path);
			return false;
		});

		async.each(pluginDirectories, function (directory, next) {
			utils.walk(directory, function (err, scripts) {
				pluginsScripts = pluginsScripts.concat(scripts);
				next(err);
			});
		}, function (err) {
			if (err) {
				return callback(err);
			}

			var basePath = path.resolve(__dirname, '../..');

			Meta.js.target[target].scripts = Meta.js.scripts.base.concat(pluginsScripts);

			if (target === 'nodebb.min.js') {
				Meta.js.target[target].scripts = Meta.js.target[target].scripts.concat(Meta.js.scripts.rjs);
			}

			Meta.js.target[target].scripts = Meta.js.target[target].scripts.map(function (script) {
				return path.relative(basePath, script).replace(/\\/g, '/');
			});

			callback();
		});
	};

	Meta.js.killMinifier = function () {
		if (Meta.js.minifierProc) {
			Meta.js.minifierProc.kill('SIGTERM');
		}
	};

	Meta.js.commitToFile = function (target, callback) {
		fs.writeFile(path.join(__dirname, '../../build/public/' + target), Meta.js.target[target].cache, function (err) {
			callback(err);
		});
	};

	function setupDebugging() {
		/**
		 * Check if the parent process is running with the debug option --debug (or --debug-brk)
		 */
		var forkProcessParams = {};
		if(global.v8debug || parseInt(process.execArgv.indexOf('--debug'), 10) !== -1) {
			/**
			 * use the line below if you want to debug minifier.js script too (or even --debug-brk option, but
			 * you'll have to setup your debugger and connect to the forked process)
			 */
			// forkProcessParams = {execArgv: ['--debug=' + (global.process.debugPort + 1), '--nolazy']};

			/**
			 * otherwise, just clean up --debug/--debug-brk options which are set up by default from the parent one
			 */
			forkProcessParams = {execArgv: []};
		}

		return forkProcessParams;
	}
};
