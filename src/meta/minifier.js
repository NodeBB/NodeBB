'use strict';

var uglifyjs = require('uglify-js');
var async = require('async');
var fs = require('fs');
var childProcess = require('child_process');
var os = require('os');
var less = require('less');
var postcss = require('postcss');
var autoprefixer = require('autoprefixer');
var clean = require('postcss-clean');

var file = require('../file');

var Minifier = module.exports;

function setupDebugging() {
	/**
	 * Check if the parent process is running with the debug option --debug (or --debug-brk)
	 */
	var forkProcessParams = {};
	if (global.v8debug || parseInt(process.execArgv.indexOf('--debug'), 10) !== -1) {
		/**
		 * use the line below if you want to debug minifier.js script too (or even --debug-brk option, but
		 * you'll have to setup your debugger and connect to the forked process)
		 */
		// forkProcessParams = { execArgv: ['--debug=' + (global.process.debugPort + 1), '--nolazy'] };

		/**
		 * otherwise, just clean up --debug/--debug-brk options which are set up by default from the parent one
		 */
		forkProcessParams = {
			execArgv: [],
		};
	}

	return forkProcessParams;
}

var children = [];

Minifier.killAll = function () {
	children.forEach(function (child) {
		child.kill('SIGTERM');
	});

	children = [];
};

function removeChild(proc) {
	children = children.filter(function (child) {
		return child !== proc;
	});
}

function forkAction(action, callback) {
	var forkProcessParams = setupDebugging();
	var proc = childProcess.fork(__filename, [], Object.assign({}, forkProcessParams, {
		cwd: __dirname,
		env: {
			minifier_child: true,
		},
	}));

	children.push(proc);

	proc.on('message', function (message) {
		if (message.type === 'error') {
			proc.kill();
			return callback(new Error(message.message));
		}

		if (message.type === 'end') {
			proc.kill();
			callback(null, message.result);
		}
	});
	proc.on('error', function (err) {
		proc.kill();
		removeChild(proc);
		callback(err);
	});

	proc.send({
		type: 'action',
		action: action,
	});

	proc.on('close', function () {
		removeChild(proc);
	});
}

var actions = {};

if (process.env.minifier_child) {
	process.on('message', function (message) {
		if (message.type === 'action') {
			var action = message.action;
			if (typeof actions[action.act] !== 'function') {
				process.send({
					type: 'error',
					message: 'Unknown action',
				});
				return;
			}

			actions[action.act](action, function (err, result) {
				if (err) {
					process.send({
						type: 'error',
						message: err.message,
					});
					return;
				}

				process.send({
					type: 'end',
					result: result,
				});
			});
		}
	});
}

function executeAction(action, fork, callback) {
	if (fork) {
		forkAction(action, callback);
	} else {
		if (typeof actions[action.act] !== 'function') {
			return callback(Error('Unknown action'));
		}
		actions[action.act](action, callback);
	}
}

function concat(data, callback) {
	if (data.files && data.files.length) {
		async.mapLimit(data.files, 1000, fs.readFile, function (err, files) {
			if (err) {
				return callback(err);
			}

			var output = files.join(os.EOL + ';');
			callback(null, { code: output });
		});

		return;
	}

	callback();
}
actions.concat = concat;

function minifyJS(data, callback) {
	var minified;

	if (data.fromSource) {
		var sources = data.source;
		var multiple = Array.isArray(sources);
		if (!multiple) {
			sources = [sources];
		}

		try {
			minified = sources.map(function (source) {
				return uglifyjs.minify(source, {
					// outSourceMap: data.filename + '.map',
					compress: data.compress,
					fromString: true,
					output: {
						// suppress uglify line length warnings
						max_line_len: 400000,
					},
				});
			});
		} catch (e) {
			return callback(e);
		}

		return callback(null, multiple ? minified : minified[0]);
	}

	if (data.files && data.files.length) {
		async.filter(data.files, file.exists, function (err, scripts) {
			if (err) {
				return callback(err);
			}

			try {
				minified = uglifyjs.minify(scripts, {
					// outSourceMap: data.filename + '.map',
					compress: data.compress,
					fromString: false,
				});
			} catch (e) {
				return callback(e);
			}

			callback(null, minified);
		});

		return;
	}

	callback();
}
actions.minifyJS = minifyJS;

Minifier.js = {};
Minifier.js.bundle = function (scripts, minify, fork, callback) {
	executeAction({
		act: minify ? 'minifyJS' : 'concat',
		files: scripts,
		compress: false,
	}, fork, callback);
};

Minifier.js.minify = function (source, fork, callback) {
	executeAction({
		act: 'minifyJS',
		fromSource: true,
		source: source,
	}, fork, callback);
};

function buildCSS(data, callback) {
	less.render(data.source, {
		paths: data.paths,
	}, function (err, lessOutput) {
		if (err) {
			return callback(err);
		}

		postcss(data.minify ? [
			autoprefixer,
			clean({
				processImportFrom: ['local'],
			}),
		] : [autoprefixer]).process(lessOutput.css).then(function (result) {
			callback(null, { code: result.css });
		}, function (err) {
			callback(err);
		});
	});
}
actions.buildCSS = buildCSS;

Minifier.css = {};
Minifier.css.bundle = function (source, paths, minify, fork, callback) {
	executeAction({
		act: 'buildCSS',
		source: source,
		paths: paths,
		minify: minify,
	}, fork, callback);
};
