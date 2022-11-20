'use strict';

const prompt = require('prompt');
const request = require('request-promise-native');
const cproc = require('child_process');
const semver = require('semver');
import * as fs from 'fs';
import path from 'path';const chalk = require('chalk');

const { paths, pluginNamePattern } = require('../constants');
const pkgInstall = require('./package-install');

const packageManager = pkgInstall.getPackageManager();
let packageManagerExecutable = packageManager;
const packageManagerInstallArgs = packageManager === 'yarn' ? ['add'] : ['install', '--save'];

if ((process as any).platform === 'win32') {
	packageManagerExecutable += '.cmd';
}

async function getModuleVersions(modules: Array<any>) {
	const versionHash = {} as any;
	const batch = require('../batch');
	await batch.processArray(modules, async (moduleNames: Array<any>) => {
		await Promise.all(moduleNames.map(async (module) => {
			let pkg = await fs.promises.readFile(
				path.join(paths.nodeModules, module, 'package.json'), { encoding: 'utf-8' }
			);
			pkg = JSON.parse(pkg);
			versionHash[module] = (pkg as any).version;
		}));
	}, {
		batch: 50,
	});

	return versionHash;
}

async function getInstalledPlugins() {
	let [deps, bundled] = await Promise.all([
		fs.promises.readFile(paths.currentPackage, { encoding: 'utf-8' }),
		fs.promises.readFile(paths.installPackage, { encoding: 'utf-8' }),
	]) as [string | string[], string | string[]];

	deps = Object.keys(JSON.parse(deps as string).dependencies)
		.filter(pkgName => pluginNamePattern.test(pkgName));
	bundled = Object.keys(JSON.parse(bundled as string).dependencies)
		.filter(pkgName => pluginNamePattern.test(pkgName));


	// Whittle down deps to send back only extraneously installed plugins/themes/etc
	const checklist = deps.filter((pkgName) => {
		if (bundled.includes(pkgName)) {
			return false;
		}

		// Ignore git repositories
		try {
			fs.accessSync(path.join(paths.nodeModules, pkgName, '.git'));
			return false;
		} catch (e: any) {
			return true;
		}
	});

	return await getModuleVersions(checklist);
}

async function getCurrentVersion() {
	let pkg = await fs.promises.readFile(paths.installPackage, { encoding: 'utf-8' });
	pkg = JSON.parse(pkg);
	return (pkg as any).version;
}

async function getSuggestedModules(nbbVersion: string | number, toCheck) {
	let body = await request({
		method: 'GET',
		url: `https://packages.nodebb.org/api/v1/suggest?version=${nbbVersion}&package[]=${toCheck.join('&package[]=')}`,
		json: true,
	});
	if (!Array.isArray(body) && toCheck.length === 1) {
		body = [body];
	}
	return body;
}

async function checkPlugins() {
	(process as any).stdout.write('Checking installed plugins and themes for updates... ');
	const [plugins, nbbVersion] = await Promise.all([
		getInstalledPlugins(),
		getCurrentVersion(),
	]);

	const toCheck = Object.keys(plugins);
	if (!toCheck.length) {
		(process as any).stdout.write(chalk.green('  OK'));
		return []; // no extraneous plugins installed
	}
	const suggestedModules = await getSuggestedModules(nbbVersion, toCheck);
	(process as any).stdout.write(chalk.green('  OK'));

	let current;
	let suggested;
	const upgradable = suggestedModules.map((suggestObj) => {
		current = plugins[suggestObj.package];
		suggested = suggestObj.version;

		if (suggestObj.code === 'match-found' && semver.gt(suggested, current)) {
			return {
				name: suggestObj.package,
				current: current,
				suggested: suggested,
			};
		}
		return null;
	}).filter(Boolean);

	return upgradable;
}

export async function upgradePlugins() {
	try {
		const found = await checkPlugins();
		if (found && found.length) {
			(process as any).stdout.write(`\n\nA total of ${chalk.bold(String(found.length))} package(s) can be upgraded:\n\n`);
			found.forEach((suggestObj) => {
				(process as any).stdout.write(`${chalk.yellow('  * ') + suggestObj.name} (${chalk.yellow(suggestObj.current)} -> ${chalk.green(suggestObj.suggested)})\n`);
			});
		} else {
			console.log(chalk.green('\nAll packages up-to-date!'));
			return;
		}

		prompt.message = '';
		prompt.delimiter = '';

		prompt.start();
		const result = await prompt.get({
			name: 'upgrade',
			description: '\nProceed with upgrade (y|n)?',
			type: 'string',
		});

		if (['y', 'Y', 'yes', 'YES'].includes(result.upgrade)) {
			console.log('\nUpgrading packages...');
			const args = packageManagerInstallArgs.concat(found.map((suggestObj) => `${suggestObj.name}@${suggestObj.suggested}`));

			cproc.execFileSync(packageManagerExecutable, args, { stdio: 'ignore' });
		} else {
			console.log(`${chalk.yellow('Package upgrades skipped')}. Check for upgrades at any time by running "${chalk.green('./nodebb upgrade -p')}".`);
		}
	} catch (err: any) {
		console.log(`${chalk.yellow('Warning')}: An unexpected error occured when attempting to verify plugin upgradability`);
		throw err;
	}
}

