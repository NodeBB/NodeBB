'use strict';

var fs = require('fs');
var os = require('os');
var path = require('path');
var uglifyjs = require('uglify-js');
var async = require('async');
var winston = require('winston');
var less = require('less');
var AutoPrefix = require('less-plugin-autoprefix');
var CleanCSS = require('less-plugin-clean-css');

var fork = require('./debugFork');
require('../file'); // for graceful-fs

var Minifier = module.exports;

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

	var proc = fork(__filename, [], {
		cwd: __dirname,
		env: {
			minifier_child: true,
		},
	});
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
			return callback(message.message);
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
					message: 'Unknown action',
				});
				return;
			}

			actions[action.act](action, function (err, result) {
				if (err) {
					process.send({
						type: 'error',
						message: err.stack,
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

Minifier.writeFiles = function (destPath, minified, callback) {
	async.parallel([
		async.apply(fs.writeFile, destPath, minified.code),
		async.apply(fs.writeFile, destPath + '.map', minified.map),
	], callback);
};

function concat(data, callback) {
	if (data.files && data.files.length) {
		async.mapLimit(data.files, 1000, function (ref, next) {
			fs.readFile(ref.srcPath, 'utf8', function (err, file) {
				if (err) {
					return next(err);
				}

				next(null, file);
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
	async.each(data.files, function (ref, next) {
		var srcPath = ref.srcPath;
		var destPath = ref.destPath;
		var filename = ref.filename;

		fs.readFile(srcPath, 'utf8', function (err, file) {
			if (err) {
				return next(err);
			}

			var scripts = {};
			scripts[filename] = file;

			try {
				var minified = uglifyjs.minify(scripts, {
					sourceMap: {
						filename: filename,
						url: filename + '.map',
						includeSources: true,
					},
					compress: false,
				});

				Minifier.writeFiles(destPath, minified, next);
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

		fs.readFile(srcPath, 'utf8', function (err, file) {
			if (err) {
				return next(err);
			}

			next(null, {
				srcPath: srcPath,
				filename: filename,
				source: file,
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

		var minified = uglifyjs.minify(scripts, {
			sourceMap: {
				filename: data.filename,
				url: data.filename + '.map',
				includeSources: true,
			},
			compress: false,
		});

		if (minified.error) {
			return callback(minified.error);
		}

		Minifier.writeFiles(data.destPath, minified, callback);
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
	var plugins = [new AutoPrefix()];
	if (data.minify) {
		plugins.push(new CleanCSS());
	}
	less.render(data.source, {
		paths: data.paths,
		plugins: plugins,
		sourceMap: {
			sourceMapURL: data.filename + '.map',
			outputSourceFiles: true,
			sourceMapBasepath: path.dirname(path.dirname(__dirname)),
		},
	}, function (err, lessOutput) {
		if (err) {
			return process.nextTick(callback, err);
		}

		process.nextTick(callback, null, {
			code: lessOutput.css,
			map: lessOutput.map,
		});
	});
}
actions.buildCSS = buildCSS;

Minifier.css = {};
Minifier.css.bundle = function (source, filename, paths, minify, fork, callback) {
	executeAction({
		act: 'buildCSS',
		filename: filename,
		source: source,
		paths: paths,
		minify: minify,
	}, fork, callback);
};
