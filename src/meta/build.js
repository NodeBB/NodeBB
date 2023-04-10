'use strict';

const os = require('os');
const winston = require('winston');
const nconf = require('nconf');
const _ = require('lodash');
const path = require('path');
const { mkdirp } = require('mkdirp');
const chalk = require('chalk');

const cacheBuster = require('./cacheBuster');
const { aliases } = require('./aliases');

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

const aliasMap = Object.keys(aliases).reduce((prev, key) => {
	const arr = aliases[key];
	arr.forEach((alias) => {
		prev[alias] = key;
	});
	prev[key] = key;
	return prev;
}, {});

async function beforeBuild(targets) {
	const db = require('../database');
	process.stdout.write(`${chalk.green('  started')}\n`);
	try {
		await db.init();
		meta = require('./index');
		await meta.themes.setupPaths();
		const plugins = require('../plugins');
		await plugins.prepareForBuild(targets);
		await mkdirp(path.join(__dirname, '../../build/public'));
	} catch (err) {
		winston.error(`[build] Encountered error preparing for build`);
		throw err;
	}
}

const allTargets = Object.keys(targetHandlers).filter(name => typeof targetHandlers[name] === 'function');

async function buildTargets(targets, parallel, options) {
	const length = Math.max(...targets.map(name => name.length));
	const jsTargets = targets.filter(target => targetHandlers.javascript.includes(target));
	const otherTargets = targets.filter(target => !targetHandlers.javascript.includes(target));
	async function buildJSTargets() {
		await Promise.all(
			jsTargets.map(
				target => step(target, parallel, `${_.padStart(target, length)} `)
			)
		);
		// run webpack after jstargets are done, no need to wait for css/templates etc.
		if (options.webpack || options.watch) {
			await exports.webpack(options);
		}
	}
	if (parallel) {
		await Promise.all([
			buildJSTargets(),
			...otherTargets.map(
				target => step(target, parallel, `${_.padStart(target, length)} `)
			),
		]);
	} else {
		for (const target of targets) {
			// eslint-disable-next-line no-await-in-loop
			await step(target, parallel, `${_.padStart(target, length)} `);
		}
		if (options.webpack || options.watch) {
			await exports.webpack(options);
		}
	}
}

async function step(target, parallel, targetStr) {
	const startTime = Date.now();
	winston.info(`[build] ${targetStr} build started`);
	try {
		await targetHandlers[target](parallel);
		const time = (Date.now() - startTime) / 1000;

		winston.info(`[build] ${targetStr} build completed in ${time}sec`);
	} catch (err) {
		winston.error(`[build] ${targetStr} build failed`);
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
		winston.verbose(`[build] System returned ${cpus.length} cores, opting for ${series ? 'series' : 'parallel'} build strategy`);
	}

	targets = targets
		// get full target name
		.map((target) => {
			target = target.toLowerCase().replace(/-/g, '');
			if (!aliasMap[target]) {
				winston.warn(`[build] Unknown target: ${target}`);
				if (target.includes(',')) {
					winston.warn('[build] Are you specifying multiple targets? Separate them with spaces:');
					winston.warn('[build]   e.g. `./nodebb build adminjs tpl`');
				}

				return false;
			}

			return aliasMap[target];
		})
		// filter nonexistent targets
		.filter(Boolean);

	// map multitargets to their sets
	targets = _.uniq(_.flatMap(targets, target => (
		Array.isArray(targetHandlers[target]) ?
			targetHandlers[target] :
			target
	)));

	winston.verbose(`[build] building the following targets: ${targets.join(', ')}`);

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
		await buildTargets(targets, !series, options);

		const totalTime = (Date.now() - startTime) / 1000;
		await cacheBuster.write();
		winston.info(`[build] Asset compilation successful. Completed in ${totalTime}sec.`);
	} catch (err) {
		winston.error(`[build] Encountered error during build step`);
		throw err;
	}
};

function getWebpackConfig() {
	return require(process.env.NODE_ENV !== 'development' ? '../../webpack.prod' : '../../webpack.dev');
}

exports.webpack = async function (options) {
	winston.info(`[build] ${(options.watch ? 'Watching' : 'Bundling')} with Webpack.`);
	const webpack = require('webpack');
	const fs = require('fs');
	const util = require('util');
	const plugins = require('../plugins/data');

	const activePlugins = (await plugins.getActive()).map(p => p.id);
	if (!activePlugins.includes('nodebb-plugin-composer-default')) {
		activePlugins.push('nodebb-plugin-composer-default');
	}
	await fs.promises.writeFile(path.resolve(__dirname, '../../build/active_plugins.json'), JSON.stringify(activePlugins));

	const webpackCfg = getWebpackConfig();
	const compiler = webpack(webpackCfg);
	const webpackRun = util.promisify(compiler.run).bind(compiler);
	const webpackWatch = util.promisify(compiler.watch).bind(compiler);
	try {
		let stats;
		if (options.watch) {
			stats = await webpackWatch(webpackCfg.watchOptions);
			compiler.hooks.assetEmitted.tap('nbbWatchPlugin', (file) => {
				console.log(`webpack:assetEmitted > ${webpackCfg.output.publicPath}${file}`);
			});
		} else {
			stats = await webpackRun();
		}

		if (stats.hasErrors() || stats.hasWarnings()) {
			console.log(stats.toString('minimal'));
		} else {
			const statsJson = stats.toJson();
			winston.info(`[build] ${(options.watch ? 'Watching' : 'Bundling')} took ${statsJson.time} ms`);
		}
	} catch (err) {
		console.error(err.stack || err);
		if (err.details) {
			console.error(err.details);
		}
	}
};

exports.buildAll = async function () {
	await exports.build(allTargets, { webpack: true });
};

require('../promisify')(exports);
