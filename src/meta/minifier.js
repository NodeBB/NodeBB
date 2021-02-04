'use strict';

const fs = require('fs');
const os = require('os');
const uglify = require('uglify-es');
const async = require('async');
const winston = require('winston');
const less = require('less');
const postcss = require('postcss');
const autoprefixer = require('autoprefixer');
const clean = require('postcss-clean');

const fork = require('./debugFork');
require('../file'); // for graceful-fs

const Minifier = module.exports;

const pool = [];
const free = [];

let maxThreads = 0;

Object.defineProperty(Minifier, 'maxThreads', {
	get: function () {
		return maxThreads;
	},
	set: function (val) {
		maxThreads = val;
		if (!process.env.minifier_child) {
			winston.verbose(`[minifier] utilizing a maximum of ${maxThreads} additional threads`);
		}
	},
	configurable: true,
	enumerable: true,
});

Minifier.maxThreads = os.cpus().length - 1;

Minifier.killAll = function () {
	pool.forEach((child) => {
		child.kill('SIGTERM');
	});

	pool.length = 0;
	free.length = 0;
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
	if (i !== -1) {
		pool.splice(i, 1);
	}
}

function forkAction(action, callback) {
	var proc = getChild();

	proc.on('message', (message) => {
		freeChild(proc);

		if (message.type === 'error') {
			return callback(message.message);
		}

		if (message.type === 'end') {
			callback(null, message.result);
		}
	});
	proc.on('error', (err) => {
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
	process.on('message', (message) => {
		if (message.type === 'action') {
			var action = message.action;
			if (typeof actions[action.act] !== 'function') {
				process.send({
					type: 'error',
					message: 'Unknown action',
				});
				return;
			}

			actions[action.act](action, (err, result) => {
				if (err) {
					process.send({
						type: 'error',
						message: err.stack || err.message || 'unknown error',
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
		async.mapLimit(data.files, 1000, (ref, next) => {
			fs.readFile(ref.srcPath, 'utf8', (err, file) => {
				if (err) {
					return next(err);
				}

				next(null, file);
			});
		}, (err, files) => {
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
	async.eachLimit(data.files, 100, (fileObj, next) => {
		fs.readFile(fileObj.srcPath, 'utf8', (err, source) => {
			if (err) {
				return next(err);
			}

			var filesToMinify = [
				{
					srcPath: fileObj.srcPath,
					filename: fileObj.filename,
					source: source,
				},
			];
			minifyAndSave({
				files: filesToMinify,
				destPath: fileObj.destPath,
				filename: fileObj.filename,
			}, next);
		});
	}, callback);
}
actions.minifyJS_batch = minifyJS_batch;

function minifyJS(data, callback) {
	async.mapLimit(data.files, 1000, (fileObj, next) => {
		fs.readFile(fileObj.srcPath, 'utf8', (err, source) => {
			if (err) {
				return next(err);
			}

			next(null, {
				srcPath: fileObj.srcPath,
				filename: fileObj.filename,
				source: source,
			});
		});
	}, (err, filesToMinify) => {
		if (err) {
			return callback(err);
		}

		minifyAndSave({
			files: filesToMinify,
			destPath: data.destPath,
			filename: data.filename,
		}, callback);
	});
}
actions.minifyJS = minifyJS;

function minifyAndSave(data, callback) {
	var scripts = {};
	data.files.forEach((ref) => {
		if (!ref) {
			return;
		}

		scripts[ref.filename] = ref.source;
	});

	var minified = uglify.minify(scripts, {
		sourceMap: {
			filename: data.filename,
			url: `${String(data.filename).split(/[/\\]/).pop()}.map`,
			includeSources: true,
		},
		compress: false,
	});

	if (minified.error) {
		return callback({ stack: `Error minifying ${minified.error.filename}\n${minified.error.stack}` });
	}

	async.parallel([
		async.apply(fs.writeFile, data.destPath, minified.code),
		async.apply(fs.writeFile, `${data.destPath}.map`, minified.map),
	], callback);
}

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
		javascriptEnabled: true,
	}, (err, lessOutput) => {
		if (err) {
			// display less parser errors properly
			return callback(new Error(String(err)));
		}

		postcss(data.minify ? [
			autoprefixer,
			clean({
				processImportFrom: ['local'],
			}),
		] : [autoprefixer]).process(lessOutput.css, {
			from: undefined,
		}).then((result) => {
			process.nextTick(callback, null, { code: result.css });
		}).catch((err) => {
			process.nextTick(callback, err);
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

require('../promisify')(exports);
