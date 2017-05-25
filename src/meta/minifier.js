'use strict';

var fs = require('fs');
var childProcess = require('child_process');
var os = require('os');
var uglifyjs = require('uglify-js');
var async = require('async');
var winston = require('winston');
var less = require('less');
var postcss = require('postcss');
var autoprefixer = require('autoprefixer');
var clean = require('postcss-clean');

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

var pool = [];
var free = [];

var maxThreads = 0;

Object.defineProperty(Minifier, 'maxThreads', {
	get: function () {
		return maxThreads;
	},
	set: function (val) {
		maxThreads = val;
		winston.verbose('[minifier] utilizing a maximum of ' + maxThreads + ' additional threads');
	},
	configurable: true,
	enumerable: true,
});

Minifier.maxThreads = os.cpus().length - 1;

Minifier.killAll = function () {
	pool.forEach(function (child) {
		child.kill('SIGTERM');
	});

	pool.length = 0;
};

function getChild() {
	if (free.length) {
		return free.shift();
	}

	var forkProcessParams = setupDebugging();
	var proc = childProcess.fork(__filename, [], Object.assign({}, forkProcessParams, {
		cwd: __dirname,
		env: {
			minifier_child: true,
		},
	}));
	pool.push(proc);

	return proc;
}

function freeChild(proc) {
	proc.removeAllListeners();
	free.push(proc);
}

function removeChild(proc) {
	var i = pool.indexOf(proc);
	pool.splice(i, 1);
}

function forkAction(action, callback) {
	var proc = getChild();

	proc.on('message', function (message) {
		freeChild(proc);

		if (message.type === 'error') {
			return callback(message.err);
		}

		if (message.type === 'end') {
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
}

var actions = {};

if (process.env.minifier_child) {
	process.on('message', function (message) {
		if (message.type === 'action') {
			var action = message.action;
			if (typeof actions[action.act] !== 'function') {
				process.send({
					type: 'error',
					err: Error('Unknown action'),
				});
				return;
			}

			actions[action.act](action, function (err, result) {
				if (err) {
					process.send({
						type: 'error',
						err: err,
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
	if (fork && (pool.length - free.length) < Minifier.maxThreads) {
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
		async.mapLimit(data.files, 1000, function (ref, next) {
			fs.readFile(ref.srcPath, function (err, buffer) {
				if (err) {
					return next(err);
				}

				next(null, buffer.toString());
			});
		}, function (err, files) {
			if (err) {
				return callback(err);
			}

			var output = files.join('\n;');
			fs.writeFile(data.destPath, output, callback);
		});

		return;
	}

	callback();
}
actions.concat = concat;

function minifyJS_batch(data, callback) {
	async.eachLimit(data.files, 1000, function (ref, next) {
		var srcPath = ref.srcPath;
		var destPath = ref.destPath;
		var filename = ref.filename;

		fs.readFile(srcPath, function (err, buffer) {
			if (err) {
				return next(err);
			}

			var scripts = {};
			scripts[filename] = buffer.toString();

			try {
				var minified = uglifyjs.minify(scripts, {
					sourceMap: {
						filename: filename,
						url: filename + '.map',
						includeSources: true,
					},
				});

				async.parallel([
					async.apply(fs.writeFile, destPath, minified.code),
					async.apply(fs.writeFile, destPath + '.map', minified.map),
				], next);
			} catch (e) {
				next(e);
			}
		});
	}, callback);
}
actions.minifyJS_batch = minifyJS_batch;

function minifyJS(data, callback) {
	async.mapLimit(data.files, 1000, function (ref, next) {
		var srcPath = ref.srcPath;
		var filename = ref.filename;

		fs.readFile(srcPath, function (err, buffer) {
			if (err) {
				return next(err);
			}

			next(null, {
				srcPath: srcPath,
				filename: filename,
				source: buffer.toString(),
			});
		});
	}, function (err, files) {
		if (err) {
			return callback(err);
		}

		var scripts = {};
		files.forEach(function (ref) {
			if (!ref) {
				return;
			}

			scripts[ref.filename] = ref.source;
		});

		try {
			var minified = uglifyjs.minify(scripts, {
				sourceMap: {
					filename: data.filename,
					url: data.filename + '.map',
					includeSources: true,
				},
				compress: {
					hoist_funs: false,
				},
			});

			async.parallel([
				async.apply(fs.writeFile, data.destPath, minified.code),
				async.apply(fs.writeFile, data.destPath + '.map', minified.map),
			], callback);
		} catch (e) {
			callback(e);
		}
	});
}
actions.minifyJS = minifyJS;

Minifier.js = {};
Minifier.js.bundle = function (data, minify, fork, callback) {
	executeAction({
		act: minify ? 'minifyJS' : 'concat',
		files: data.files,
		filename: data.filename,
		destPath: data.destPath,
	}, fork, callback);
};

Minifier.js.minifyBatch = function (scripts, fork, callback) {
	executeAction({
		act: 'minifyJS_batch',
		files: scripts,
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
