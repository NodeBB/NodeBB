'use strict';

var winston = require('winston'),
	fork = require('child_process').fork,
	path = require('path'),
	async = require('async'),
	_ = require('underscore'),
	nconf = require('nconf'),
	fs = require('fs'),
	rimraf = require('rimraf'),
	file = require('../file'),
	plugins = require('../plugins'),
	emitter = require('../emitter'),
	utils = require('../../public/src/utils');

module.exports = function(Meta) {

	Meta.js = {
		target: {},
		scripts: {
			base: [
				'public/vendor/jquery/js/jquery.js',
				'./node_modules/socket.io-client/socket.io.js',
				'public/vendor/jquery/timeago/jquery.timeago.js',
				'public/vendor/jquery/js/jquery.form.min.js',
				'public/vendor/visibility/visibility.min.js',
				'public/vendor/bootstrap/js/bootstrap.min.js',
				'public/vendor/jquery/bootstrap-tagsinput/bootstrap-tagsinput.min.js',
				'public/vendor/jquery/textcomplete/jquery.textcomplete.min.js',
				'public/vendor/requirejs/require.js',
				'public/vendor/bootbox/bootbox.min.js',
				'public/vendor/tinycon/tinycon.js',
				'public/vendor/xregexp/xregexp.js',
				'public/vendor/xregexp/unicode/unicode-base.js',
				'public/vendor/buzz/buzz.min.js',
				'public/vendor/mousetrap/mousetrap.js',
				'public/vendor/autosize.js',
				'./node_modules/templates.js/lib/templates.js',
				'public/src/utils.js',
				'public/src/sockets.js',
				'public/src/app.js',
				'public/src/ajaxify.js',
				'public/src/overrides.js',
				'public/src/variables.js',
				'public/src/widgets.js'
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
				'public/src/client/categoryTools.js',

				'public/src/modules/csrf.js',
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
				'public/src/modules/string.js'
			],

			// modules listed below are symlinked to public/src/modules so they can be defined anonymously
			modules: [
				'./node_modules/chart.js/Chart.js'
			]
		}
	};

	Meta.js.symlinkModules = function(callback) {
		// Symlink all defined modules to /public/src/modules
		var modulesLoaded = 0,
			targetPath;

		async.series([
			function(next) {
				async.each(Meta.js.scripts.modules, function(localPath, next) {
					targetPath = path.join(__dirname, '../../public/src/modules', path.basename(localPath));

					async.waterfall([
						async.apply(fs.access, localPath, fs.R_OK),
						async.apply(rimraf, targetPath),
						async.apply(fs.link, localPath, targetPath)
					], function(err) {
						if (err) {
							winston.error('[meta/js] Could not symlink `' + localPath + '` to modules folder');
						} else {
							winston.verbose('[meta/js] Symlinked `' + localPath + '` to modules folder');
							++modulesLoaded;
						}

						next(err);
					});
				}, next);
			}
		], function(err) {
			if (err) {
				winston.error('[meta/js] Encountered error while symlinking modules:' + err.message);
			}

			winston.verbose('[meta/js] ' + modulesLoaded + ' of ' + Meta.js.scripts.modules.length + ' modules symlinked');
			callback(err);
		});
	};

	Meta.js.minify = function(target, callback) {
		if (nconf.get('isPrimary') !== 'true') {
			if (typeof callback === 'function') {
				callback();
			}

			return;
		}

		var forkProcessParams = setupDebugging();
		var minifier = Meta.js.minifierProc = fork('minifier.js', [], forkProcessParams);

		Meta.js.target[target] = {};

		Meta.js.prepare(target, function() {
			minifier.send({
				action: 'js',
				minify: global.env !== 'development',
				scripts: Meta.js.target[target].scripts
			});
		});

		minifier.on('message', function(message) {
			switch(message.type) {
			case 'end':
				Meta.js.target[target].cache = message.minified;
				Meta.js.target[target].map = message.sourceMap;
				winston.verbose('[meta/js] ' + target + ' minification complete');
				minifier.kill();

				if (process.send) {
					process.send({
						action: 'js-propagate',
						cache: Meta.js.target[target].cache,
						map: Meta.js.target[target].map
					});
				}

				Meta.js.commitToFile(target);

				if (typeof callback === 'function') {
					callback();
				}
				break;
			case 'error':
				winston.error('[meta/js] Could not compile ' + target + ': ' + message.message);
				minifier.kill();

				if (typeof callback === 'function') {
					callback(new Error(message.message));
				} else {
					process.exit(0);
				}
				break;
			}
		});
	};

	Meta.js.prepare = function(target, callback) {
		var pluginsScripts = [];

		var pluginDirectories = [];

		pluginsScripts = plugins[target === 'nodebb.min.js' ? 'clientScripts' : 'acpScripts'].filter(function(path) {
			if (path.endsWith('.js')) {
				return true;
			}

			pluginDirectories.push(path);
			return false;
		});

		async.each(pluginDirectories, function(directory, next) {
			utils.walk(directory, function(err, scripts) {
				pluginsScripts = pluginsScripts.concat(scripts);
				next(err);
			});
		}, function(err) {
			if (err) {
				return callback(err);
			}

			var basePath = path.resolve(__dirname, '../..');

			Meta.js.target[target].scripts = Meta.js.scripts.base.concat(pluginsScripts);

			if (target === 'nodebb.min.js') {
				Meta.js.target[target].scripts = Meta.js.target[target].scripts.concat(Meta.js.scripts.rjs);
			}

			Meta.js.target[target].scripts = Meta.js.target[target].scripts.map(function(script) {
				return path.relative(basePath, script).replace(/\\/g, '/');
			});

			callback();
		});
	};

	Meta.js.killMinifier = function() {
		if (Meta.js.minifierProc) {
			Meta.js.minifierProc.kill('SIGTERM');
		}
	};

	Meta.js.commitToFile = function(target) {
		fs.writeFile(path.join(__dirname, '../../public/' + target), Meta.js.target[target].cache, function (err) {
			if (err) {
				winston.error('[meta/js] ' + err.message);
				process.exit(0);
			}

			winston.verbose('[meta/js] ' + target + ' committed to disk.');
			emitter.emit('meta:js.compiled');
		});
	};

	Meta.js.getFromFile = function(target, callback) {
		var scriptPath = path.join(__dirname, '../../public/' + target),
			mapPath = path.join(__dirname, '../../public/' + target + '.map'),
			paths = [scriptPath];

		file.exists(scriptPath, function(exists) {
			if (!exists) {
				winston.warn('[meta/js] ' + target + ' not found on disk, re-minifying');
				Meta.js.minify(target, callback);
				return;
			}

			if (nconf.get('isPrimary') !== 'true') {
				return callback();
			}

			file.exists(mapPath, function(exists) {
				if (exists) {
					paths.push(mapPath);
				}

				async.map(paths, fs.readFile, function(err, files) {
					Meta.js.target[target] = {
						cache: files[0],
						map: files[1] || ''
					};

					emitter.emit('meta:js.compiled');
					callback();
				});
			});
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
			//forkProcessParams = {execArgv: ['--debug=' + (global.process.debugPort + 1), '--nolazy']};

			/**
			 * otherwise, just clean up --debug/--debug-brk options which are set up by default from the parent one
			 */
			forkProcessParams = {execArgv: []};
		}

		return forkProcessParams;
	}
};
