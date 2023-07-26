'use strict';

const fs = require('fs');
const os = require('os');
const async = require('async');
const winston = require('winston');
const postcss = require('postcss');
const autoprefixer = require('autoprefixer');
const clean = require('postcss-clean');
const rtlcss = require('rtlcss');
const sass = require('../utils').getSass();

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

Minifier.maxThreads = Math.max(1, os.cpus().length - 1);

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

Minifier.js = {};
Minifier.js.bundle = async function (data, fork) {
	return await executeAction({
		act: 'concat',
		files: data.files,
		filename: data.filename,
		destPath: data.destPath,
	}, fork);
};

actions.buildCSS = async function buildCSS(data) {
	let css = '';
	try {
		const scssOutput = await sass.compileStringAsync(data.source, {
			loadPaths: data.paths,
		});
		css = scssOutput.css.toString();
	} catch (err) {
		console.error(err.stack);
	}


	async function processScss(direction) {
		if (direction === 'rtl') {
			css = await postcss([rtlcss()]).process(css, {
				from: undefined,
			});
		}
		const postcssArgs = [autoprefixer];
		if (data.minify) {
			postcssArgs.push(clean({
				processImportFrom: ['local'],
			}));
		}
		return await postcss(postcssArgs).process(css, {
			from: undefined,
		});
	}

	const [ltrresult, rtlresult] = await Promise.all([
		processScss('ltr'),
		processScss('rtl'),
	]);

	return {
		ltr: { code: ltrresult.css },
		rtl: { code: rtlresult.css },
	};
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
