'use strict';

import fs from 'fs';
import os from 'os';
import async from 'async';
import winston from 'winston';
import postcss from 'postcss';
import autoprefixer from 'autoprefixer';
import clean from 'postcss-clean';
import rtlcss from 'rtlcss';
import sassUtils from '../utils';
import fork from './debugFork';

const sass = sassUtils.getSass();

import '../file'; // for graceful-fs

const Minifier = {} as any;

const pool = [];
const free = [];

let maxThreads = 0;

Object.defineProperty(Minifier, 'maxThreads', {
	get: function () {
		return maxThreads;
	},
	set: function (val) {
		maxThreads = val;
		if (!(process as any).env.minifier_child) {
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

const actions = {} as any;

if ((process as any).env.minifier_child) {
	(process as any).on('message', async (message: any) => {
		if (message.type === 'action') {
			const { action } = message;
			if (typeof actions[action.act] !== 'function') {
				(process as any).send({
					type: 'error',
					message: 'Unknown action',
				});
				return;
			}
			try {
				const result = await actions[action.act](action);
				(process as any).send({
					type: 'end',
					result: result,
				});
			} catch (err: any) {
				(process as any).send({
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
	const scssOutput = await sass.compileStringAsync(data.source, {
		loadPaths: data.paths,
	});

	async function processScss(direction) {
		const postcssArgs = [autoprefixer];
		if (direction === 'rtl') {
			postcssArgs.unshift(rtlcss());
		}
		if (data.minify) {
			postcssArgs.push(clean({
				processImportFrom: ['local'],
			}));
		}
		return await postcss(postcssArgs).process(scssOutput.css.toString(), {
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

import promisify from '../promisify';
promisify(Minifier(exports));

export default Minifier;
