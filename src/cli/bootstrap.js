/* eslint-disable import/order */

'use strict';

const fs = require('fs');
const path = require('path');

require('../../require-main');

const packageInstall = require('./package-install');
const { paths } = require('../constants');

try {
	fs.accessSync(paths.currentPackage, fs.constants.R_OK); // throw on missing package.json
	try { // handle missing node_modules/ directory
		fs.accessSync(paths.nodeModules, fs.constants.R_OK);
	} catch (e) {
		if (e.code === 'ENOENT') {
			// run package installation just to sync up node_modules/ with existing package.json
			packageInstall.installAll();
		} else {
			throw e;
		}
	}
	fs.accessSync(path.join(paths.nodeModules, 'semver/package.json'), fs.constants.R_OK);

	const semver = require('semver');
	const defaultPackage = require('../../install/package.json');

	const checkVersion = function (packageName) {
		if (defaultPackage.dependencies[packageName] == null) {
			const e = new TypeError(`Attempt to \`checkVersion('${packageName}')\`, but no "${packageName}" dependency entry in 'install/package.json'.`);
			e.code = 'DEP_NOT_DEFINED';
			throw e;
		}

		const { version } = JSON.parse(fs.readFileSync(path.join(paths.nodeModules, packageName, 'package.json'), 'utf8'));
		if (!semver.satisfies(version, defaultPackage.dependencies[packageName])) {
			const e = new TypeError(`Incorrect dependency version: ${packageName}`);
			e.code = 'DEP_WRONG_VERSION';
			throw e;
		}
	};

	checkVersion('nconf');
	checkVersion('async');
	checkVersion('commander');
	checkVersion('chalk');
	checkVersion('lodash');
	checkVersion('lru-cache');
	checkVersion('typescript');
} catch (e) {
	if (['ENOENT', 'DEP_WRONG_VERSION', 'MODULE_NOT_FOUND'].includes(e.code)) {
		console.info(e);

		console.warn('Dependencies outdated or not yet installed.');
		console.log('Installing them now...\n');

		packageInstall.updatePackageFile();
		packageInstall.preserveExtraneousPlugins();
		packageInstall.installAll();

		const chalk = require('chalk');
		console.log(`${chalk.green('OK')}\n`);
	} else {
		throw e;
	}
}

console.log('Running typescript to transpile files...');

const child_process = require('child_process');
const chalk = require('chalk');

const tsc = path.join(paths.nodeModules, '.bin/tsc');

try {
	child_process.execFileSync(tsc, [
		'--skipLibCheck',
		'--noResolve',
		'--noLib',
	], {
		cwd: paths.baseDir,
		stdio: 'ignore',
	});
} catch (e) {
	if (e.status == null) {
		throw e;
	}
}

console.log(`${chalk.green('OK')}\n`);

require('../../build/src/cli');
