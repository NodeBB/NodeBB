'use strict';

const os = require('os');
const winston = require('winston');
const nconf = require('nconf');
const _ = require('lodash');
const path = require('path');
const mkdirp = require('mkdirp');

const cacheBuster = require('./cacheBuster');
let meta;

const targetHandlers = {
	'plugin static dirs': async function () {
		await meta.js.linkStatics();
	},
	'requirejs modules': async function (parallel) {
		await meta.js.buildModules(parallel);
	},
	'client js bundle': async function (parallel) {
		await meta.js.buildBundle('client', parallel);
	},
	'admin js bundle': async function (parallel) {
		await meta.js.buildBundle('admin', parallel);
	},
	javascript: [
		'plugin static dirs',
		'requirejs modules',
		'client js bundle',
		'admin js bundle',
	],
	'client side styles': async function (parallel) {
		await meta.css.buildBundle('client', parallel);
	},
	'admin control panel styles': async function (parallel) {
		await meta.css.buildBundle('admin', parallel);
	},
	styles: [
		'client side styles',
		'admin control panel styles',
	],
	templates: async function () {
		await meta.templates.compile();
	},
	languages: async function () {
		await meta.languages.build();
	},
};

let aliases = {
	'plugin static dirs': ['staticdirs'],
	'requirejs modules': ['rjs', 'modules'],
	'client js bundle': ['clientjs', 'clientscript', 'clientscripts'],
	'admin js bundle': ['adminjs', 'adminscript', 'adminscripts'],
	javascript: ['js'],
	'client side styles': [
		'clientcss', 'clientless', 'clientstyles', 'clientstyle',
	],
	'admin control panel styles': [
		'admincss', 'adminless', 'adminstyles', 'adminstyle', 'acpcss', 'acpless', 'acpstyles', 'acpstyle',
	],
	styles: ['css', 'less', 'style'],
	templates: ['tpl'],
	languages: ['lang', 'i18n'],
};

exports.aliases = aliases;

aliases = Object.keys(aliases).reduce(function (prev, key) {
	var arr = aliases[key];
	arr.forEach(function (alias) {
		prev[alias] = key;
	});
	prev[key] = key;
	return prev;
}, {});

async function beforeBuild(targets) {
	const db = require('../database');
	require('colors');
	process.stdout.write('  started'.green + '\n'.reset);
	try {
		await db.init();
		meta = require('./index');
		await meta.themes.setupPaths();
		const plugins = require('../plugins');
		await plugins.prepareForBuild(targets);
		await mkdirp(path.join(__dirname, '../../build/public'));
	} catch (err) {
		winston.error('[build] Encountered error preparing for build\n' + err.stack);
		throw err;
	}
}

const allTargets = Object.keys(targetHandlers).filter(function (name) {
	return typeof targetHandlers[name] === 'function';
});

async function buildTargets(targets, parallel) {
	const length = Math.max.apply(Math, targets.map(name => name.length));

	if (parallel) {
		await Promise.all(
			targets.map(
				target => step(target, parallel, _.padStart(target, length) + ' ')
			)
		);
	} else {
		for (const target of targets) {
			// eslint-disable-next-line no-await-in-loop
			await step(target, parallel, _.padStart(target, length) + ' ');
		}
	}
}

async function step(target, parallel, targetStr) {
	const startTime = Date.now();
	winston.info('[build] ' + targetStr + ' build started');
	try {
		await targetHandlers[target](parallel);
		const time = (Date.now() - startTime) / 1000;

		winston.info('[build] ' + targetStr + ' build completed in ' + time + 'sec');
	} catch (err) {
		winston.error('[build] ' + targetStr + ' build failed');
		throw err;
	}
}

exports.build = async function (targets, options) {
	if (!options) {
		options = {};
	}

	if (targets === true) {
		targets = allTargets;
	} else if (!Array.isArray(targets)) {
		targets = targets.split(',');
	}

	let series = nconf.get('series') || options.series;
	if (series === undefined) {
		// Detect # of CPUs and select strategy as appropriate
		winston.verbose('[build] Querying CPU core count for build strategy');
		const cpus = os.cpus();
		series = cpus.length < 4;
		winston.verbose('[build] System returned ' + cpus.length + ' cores, opting for ' + (series ? 'series' : 'parallel') + ' build strategy');
	}

	targets = targets
		// get full target name
		.map(function (target) {
			target = target.toLowerCase().replace(/-/g, '');
			if (!aliases[target]) {
				winston.warn('[build] Unknown target: ' + target);
				if (target.includes(',')) {
					winston.warn('[build] Are you specifying multiple targets? Separate them with spaces:');
					winston.warn('[build]   e.g. `./nodebb build adminjs tpl`');
				}

				return false;
			}

			return aliases[target];
		})
		// filter nonexistent targets
		.filter(Boolean);

	// map multitargets to their sets
	targets = _.uniq(_.flatMap(targets, target => (
		Array.isArray(targetHandlers[target]) ?
			targetHandlers[target] :
			target
	)));

	winston.verbose('[build] building the following targets: ' + targets.join(', '));

	if (!targets) {
		winston.info('[build] No valid targets supplied. Aborting.');
		return;
	}

	try {
		await beforeBuild(targets);
		const threads = parseInt(nconf.get('threads'), 10);
		if (threads) {
			require('./minifier').maxThreads = threads - 1;
		}

		if (!series) {
			winston.info('[build] Building in parallel mode');
		} else {
			winston.info('[build] Building in series mode');
		}

		const startTime = Date.now();
		await buildTargets(targets, !series);
		const totalTime = (Date.now() - startTime) / 1000;
		await cacheBuster.write();
		winston.info('[build] Asset compilation successful. Completed in ' + totalTime + 'sec.');
	} catch (err) {
		winston.error('[build] Encountered error during build step\n' + (err.stack ? err.stack : err));
		throw err;
	}
};

exports.buildAll = async function () {
	await exports.build(allTargets);
};

require('../promisify')(exports);
