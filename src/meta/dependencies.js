'use strict';

const path = require('path');
const fs = require('fs');

const semver = require('semver');
const winston = require('winston');
const chalk = require('chalk');

const pkg = require('../../package.json');
const { paths, pluginNamePattern } = require('../constants');

const Dependencies = module.exports;

let depsMissing = false;
let depsOutdated = false;

Dependencies.check = async function () {
	const modules = Object.keys(pkg.dependencies);

	winston.verbose('Checking dependencies for outdated modules');

	await Promise.all(modules.map(module => Dependencies.checkModule(module)));

	if (depsMissing) {
		throw new Error('dependencies-missing');
	} else if (depsOutdated && global.env !== 'development') {
		throw new Error('dependencies-out-of-date');
	}
};

Dependencies.checkModule = async function (moduleName) {
	try {
		let pkgData = await fs.promises.readFile(path.join(paths.nodeModules, moduleName, 'package.json'), 'utf8');
		pkgData = Dependencies.parseModuleData(moduleName, pkgData);

		const satisfies = Dependencies.doesSatisfy(pkgData, pkg.dependencies[moduleName]);
		return satisfies;
	} catch (err) {
		if (err.code === 'ENOENT' && pluginNamePattern.test(moduleName)) {
			winston.warn(`[meta/dependencies] Bundled plugin ${moduleName} not found, skipping dependency check.`);
			return true;
		}
		throw err;
	}
};

Dependencies.parseModuleData = function (moduleName, pkgData) {
	try {
		pkgData = JSON.parse(pkgData);
	} catch (e) {
		winston.warn(`[${chalk.red('missing')}] ${chalk.bold(moduleName)} is a required dependency but could not be found\n`);
		depsMissing = true;
		return null;
	}
	return pkgData;
};

Dependencies.doesSatisfy = function (moduleData, packageJSONVersion) {
	if (!moduleData) {
		return false;
	}
	const versionOk = !semver.validRange(packageJSONVersion) || semver.satisfies(moduleData.version, packageJSONVersion);
	const githubRepo = moduleData._resolved && moduleData._resolved.includes('//github.com');
	const satisfies = versionOk || githubRepo;
	if (!satisfies) {
		winston.warn(`[${chalk.yellow('outdated')}] ${chalk.bold(moduleData.name)} installed v${moduleData.version}, package.json requires ${packageJSONVersion}\n`);
		depsOutdated = true;
	}
	return satisfies;
};
