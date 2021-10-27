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

	const proc = fork(__filename, [], {
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
	const i = pool.indexOf(proc);
	if (i !== -1) {
		pool.splice(i, 1);
	}
}

function forkAction(action) {
	return new Promise((resolve, reject) => {
		const proc = getChild();
		proc.on('message', (message) => {
			freeChild(proc);

			if (message.type === 'error') {
				return reject(new Error(message.message));
			}

			if (message.type === 'end') {
				resolve(message.result);
			}
		});
		proc.on('error', (err) => {
			proc.kill();
			removeChild(proc);
			reject(err);
		});

		proc.send({
			type: 'action',
			action: action,
		});
	});
}

const actions = {};

if (process.env.minifier_child) {
	process.on('message', async (message) => {
		if (message.type === 'action') {
			const { action } = message;
			if (typeof actions[action.act] !== 'function') {
				process.send({
					type: 'error',
					message: 'Unknown action',
				});
				return;
			}
			try {
				const result = await actions[action.act](action);
				process.send({
					type: 'end',
					result: result,
				});
			} catch (err) {
				process.send({
					type: 'error',
					message: err.stack || err.message || 'unknown error',
				});
			}
		}
	});
}

async function executeAction(action, fork) {
	if (fork && (pool.length - free.length) < Minifier.maxThreads) {
		return await forkAction(action);
	}
	if (typeof actions[action.act] !== 'function') {
		throw new Error('Unknown action');
	}
	return await actions[action.act](action);
}

actions.concat = async function concat(data) {
	if (data.files && data.files.length) {
		const files = await async.mapLimit(data.files, 1000, async ref => await fs.promises.readFile(ref.srcPath, 'utf8'));
		const output = files.join('\n;');
		await fs.promises.writeFile(data.destPath, output);
	}
};

actions.minifyJS_batch = async function minifyJS_batch(data) {
	await async.eachLimit(data.files, 100, async (fileObj) => {
		const source = await fs.promises.readFile(fileObj.srcPath, 'utf8');
		const filesToMinify = [
			{
				srcPath: fileObj.srcPath,
				filename: fileObj.filename,
				source: source,
			},
		];

		await minifyAndSave({
			files: filesToMinify,
			destPath: fileObj.destPath,
			filename: fileObj.filename,
		});
	});
};

actions.minifyJS = async function minifyJS(data) {
	const filesToMinify = await async.mapLimit(data.files, 1000, async (fileObj) => {
		const source = await fs.promises.readFile(fileObj.srcPath, 'utf8');
		return {
			srcPath: fileObj.srcPath,
			filename: fileObj.filename,
			source: source,
		};
	});
	await minifyAndSave({
		files: filesToMinify,
		destPath: data.destPath,
		filename: data.filename,
	});
};

async function minifyAndSave(data) {
	const scripts = {};
	data.files.forEach((ref) => {
		if (ref && ref.filename && ref.source) {
			scripts[ref.filename] = ref.source;
		}
	});

	const minified = uglify.minify(scripts, {
		sourceMap: {
			filename: data.filename,
			url: `${String(data.filename).split(/[/\\]/).pop()}.map`,
			includeSources: true,
		},
		compress: false,
	});

	if (minified.error) {
		throw new Error(`Error minifying ${minified.error.filename}\n${minified.error.stack}`);
	}
	await Promise.all([
		fs.promises.writeFile(data.destPath, minified.code),
		fs.promises.writeFile(`${data.destPath}.map`, minified.map),
	]);
}

Minifier.js = {};
Minifier.js.bundle = async function (data, minify, fork) {
	return await executeAction({
		act: minify ? 'minifyJS' : 'concat',
		files: data.files,
		filename: data.filename,
		destPath: data.destPath,
	}, fork);
};

Minifier.js.minifyBatch = async function (scripts, fork) {
	return await executeAction({
		act: 'minifyJS_batch',
		files: scripts,
	}, fork);
};

actions.buildCSS = async function buildCSS(data) {
	const lessOutput = await less.render(data.source, {
		paths: data.paths,
		javascriptEnabled: true,
	});

	const postcssArgs = [autoprefixer];
	if (data.minify) {
		postcssArgs.push(clean({
			processImportFrom: ['local'],
		}));
	}
	const result = await postcss(postcssArgs).process(lessOutput.css, {
		from: undefined,
	});
	return { code: result.css };
};

Minifier.css = {};
Minifier.css.bundle = async function (source, paths, minify, fork) {
	return await executeAction({
		act: 'buildCSS',
		source: source,
		paths: paths,
		minify: minify,
	}, fork);
};

require('../promisify')(exports);
