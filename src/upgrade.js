
'use strict';

const path = require('path');
const util = require('util');
const semver = require('semver');
const readline = require('readline');
const winston = require('winston');
const chalk = require('chalk');

const plugins = require('./plugins');
const db = require('./database');
const file = require('./file');
const { paths } = require('./constants');
/*
 * Need to write an upgrade script for NodeBB? Cool.
 *
 * 1. Copy TEMPLATE to a unique file name of your choice. Try to be succinct.
 * 2. Open up that file and change the user-friendly name (can be longer/more descriptive than the file name)
 *    and timestamp (don't forget the timestamp!)
 * 3. Add your script under the "method" property
 */

const Upgrade = module.exports;

Upgrade.getAll = async function () {
	let files = await file.walk(path.join(__dirname, './upgrades'));

	// Sort the upgrade scripts based on version
	files = files.filter(file => path.basename(file) !== 'TEMPLATE').sort((a, b) => {
		const versionA = path.dirname(a).split(path.sep).pop();
		const versionB = path.dirname(b).split(path.sep).pop();
		const semverCompare = semver.compare(versionA, versionB);
		if (semverCompare) {
			return semverCompare;
		}
		const timestampA = require(a).timestamp;
		const timestampB = require(b).timestamp;
		return timestampA - timestampB;
	});

	await Upgrade.appendPluginScripts(files);

	// check duplicates and error
	const seen = {};
	const dupes = [];
	files.forEach((file) => {
		if (seen[file]) {
			dupes.push(file);
		} else {
			seen[file] = true;
		}
	});
	if (dupes.length) {
		winston.error(`Found duplicate upgrade scripts\n${dupes}`);
		throw new Error('[[error:duplicate-upgrade-scripts]]');
	}

	return files;
};

Upgrade.appendPluginScripts = async function (files) {
	// Find all active plugins
	const activePlugins = await plugins.getActive();
	activePlugins.forEach((plugin) => {
		const configPath = path.join(paths.nodeModules, plugin, 'plugin.json');
		try {
			const pluginConfig = require(configPath);
			if (pluginConfig.hasOwnProperty('upgrades') && Array.isArray(pluginConfig.upgrades)) {
				pluginConfig.upgrades.forEach((script) => {
					files.push(path.join(path.dirname(configPath), script));
				});
			}
		} catch (e) {
			if (e.code !== 'MODULE_NOT_FOUND') {
				winston.error(e.stack);
			}
		}
	});
	return files;
};

Upgrade.check = async function () {
	// Throw 'schema-out-of-date' if not all upgrade scripts have run
	const files = await Upgrade.getAll();
	const executed = await db.getSortedSetRange('schemaLog', 0, -1);
	const remainder = files.filter(name => !executed.includes(path.basename(name, '.js')));
	if (remainder.length > 0) {
		throw new Error('schema-out-of-date');
	}
};

Upgrade.run = async function () {
	console.log('\nParsing upgrade scripts... ');

	const [completed, available] = await Promise.all([
		db.getSortedSetRange('schemaLog', 0, -1),
		Upgrade.getAll(),
	]);

	let skipped = 0;
	const queue = available.filter((cur) => {
		const upgradeRan = completed.includes(path.basename(cur, '.js'));
		if (upgradeRan) {
			skipped += 1;
		}
		return !upgradeRan;
	});

	await Upgrade.process(queue, skipped);
};

Upgrade.runParticular = async function (names) {
	console.log('\nParsing upgrade scripts... ');
	const files = await file.walk(path.join(__dirname, './upgrades'));
	await Upgrade.appendPluginScripts(files);
	const upgrades = files.filter(file => names.includes(path.basename(file, '.js')));
	await Upgrade.process(upgrades, 0);
};

Upgrade.process = async function (files, skipCount) {
	console.log(`${chalk.green('OK')} | ${chalk.cyan(`${files.length} script(s) found`)}${skipCount > 0 ? chalk.cyan(`, ${skipCount} skipped`) : ''}`);
	const [schemaDate, schemaLogCount] = await Promise.all([
		db.get('schemaDate'),
		db.sortedSetCard('schemaLog'),
	]);

	for (const file of files) {
		/* eslint-disable no-await-in-loop */
		const scriptExport = require(file);
		const date = new Date(scriptExport.timestamp);
		const version = path.dirname(file).split('/').pop();
		const progress = {
			current: 0,
			counter: 0,
			total: 0,
			incr: Upgrade.incrementProgress,
			script: scriptExport,
			date: date,
		};

		process.stdout.write(`${chalk.white('  → ') + chalk.gray(`[${[date.getUTCFullYear(), date.getUTCMonth() + 1, date.getUTCDate()].join('/')}] `) + scriptExport.name}...`);

		// For backwards compatibility, cross-reference with schemaDate (if found). If a script's date is older, skip it
		if ((!schemaDate && !schemaLogCount) || (scriptExport.timestamp <= schemaDate && semver.lt(version, '1.5.0'))) {
			process.stdout.write(chalk.grey(' skipped\n'));

			await db.sortedSetAdd('schemaLog', Date.now(), path.basename(file, '.js'));
			// eslint-disable-next-line no-continue
			continue;
		}

		// Promisify method if necessary
		if (scriptExport.method.constructor && scriptExport.method.constructor.name !== 'AsyncFunction') {
			scriptExport.method = util.promisify(scriptExport.method);
		}

		// Do the upgrade...
		const upgradeStart = Date.now();
		try {
			await scriptExport.method.bind({
				progress: progress,
			})();
		} catch (err) {
			console.error('Error occurred');
			throw err;
		}
		const upgradeDuration = ((Date.now() - upgradeStart) / 1000).toFixed(2);
		process.stdout.write(chalk.green(` OK (${upgradeDuration} seconds)\n`));

		// Record success in schemaLog
		await db.sortedSetAdd('schemaLog', Date.now(), path.basename(file, '.js'));
	}

	console.log(chalk.green('Schema update complete!\n'));
};

Upgrade.incrementProgress = function (value) {
	// Newline on first invocation
	if (this.current === 0) {
		process.stdout.write('\n');
	}

	this.current += value || 1;
	this.counter += value || 1;
	const step = (this.total ? Math.floor(this.total / 100) : 100);

	if (this.counter > step || this.current >= this.total) {
		this.counter -= step;
		let percentage = 0;
		let filled = 0;
		let unfilled = 15;
		if (this.total) {
			percentage = `${Math.floor((this.current / this.total) * 100)}%`;
			filled = Math.floor((this.current / this.total) * 15);
			unfilled = Math.max(0, 15 - filled);
		}

		readline.cursorTo(process.stdout, 0);
		process.stdout.write(`    [${filled ? new Array(filled).join('#') : ''}${new Array(unfilled).join(' ')}] (${this.current}/${this.total || '??'}) ${percentage} `);
	}
};

require('./promisify')(Upgrade);
