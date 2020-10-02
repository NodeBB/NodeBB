'use strict';

const path = require('path');
const fs = require('fs');
const cproc = require('child_process');

const { paths, pluginNamePattern } = require('../constants');

function updatePackageFile() {
	let oldPackageContents = {};

	try {
		oldPackageContents = JSON.parse(fs.readFileSync(paths.currentPackage, 'utf8'));
	} catch (e) {
		if (e.code !== 'ENOENT') {
			throw e;
		}
	}

	const defaultPackageContents = JSON.parse(fs.readFileSync(paths.installPackage, 'utf8'));

	let dependencies = {};
	Object.entries(oldPackageContents.dependencies || {}).forEach(([dep, version]) => {
		if (pluginNamePattern.test(dep)) {
			dependencies[dep] = version;
		}
	});

	// Sort dependencies alphabetically
	dependencies = Object.entries({ ...dependencies, ...defaultPackageContents.dependencies }).sort((a, b) => (a < b ? -1 : 1)).reduce((memo, pkg) => {
		memo[pkg[0]] = pkg[1];
		return memo;
	}, {});

	const packageContents = { ...oldPackageContents, ...defaultPackageContents, dependencies: dependencies };

	fs.writeFileSync(paths.currentPackage, JSON.stringify(packageContents, null, 2));
}

exports.updatePackageFile = updatePackageFile;

exports.supportedPackageManager = [
	'npm',
	'cnpm',
	'pnpm',
	'yarn',
];

function installAll() {
	const prod = global.env !== 'development';
	let command = 'npm install';
	try {
		fs.accessSync(path.join(paths.nodeModules, 'nconf/package.json'), fs.constants.R_OK);
		const supportedPackageManagerList = exports.supportedPackageManager; // load config from src/cli/package-install.js
		const packageManager = require('nconf').get('package_manager');
		if (supportedPackageManagerList.indexOf(packageManager) >= 0) {
			switch (packageManager) {
				case 'yarn':
					command = 'yarn';
					break;
				case 'pnpm':
					command = 'pnpm install';
					break;
				case 'cnpm':
					command = 'cnpm install';
					break;
				default:
					break;
			}
		}
	} catch (e) {
		// ignore
	}
	try {
		cproc.execSync(command + (prod ? ' --production' : ''), {
			cwd: path.join(__dirname, '../../'),
			stdio: [0, 1, 2],
		});
	} catch (e) {
		console.log('Error installing dependencies!');
		console.log('message: ' + e.message);
		console.log('stdout: ' + e.stdout);
		console.log('stderr: ' + e.stderr);
		throw e;
	}
}

exports.installAll = installAll;

function preserveExtraneousPlugins() {
	// Skip if `node_modules/` is not found or inaccessible
	try {
		fs.accessSync(paths.nodeModules, fs.constants.R_OK);
	} catch (e) {
		return;
	}

	const packages = fs.readdirSync(paths.nodeModules).filter(function (pkgName) {
		return pluginNamePattern.test(pkgName);
	});
	const packageContents = JSON.parse(fs.readFileSync(paths.currentPackage, 'utf8'));

	const extraneous = packages
		// only extraneous plugins (ones not in package.json) which are not links
		.filter(function (pkgName) {
			const extraneous = !packageContents.dependencies.hasOwnProperty(pkgName);
			const isLink = fs.lstatSync(path.join(paths.nodeModules, pkgName)).isSymbolicLink();

			return extraneous && !isLink;
		})
		// reduce to a map of package names to package versions
		.reduce(function (map, pkgName) {
			const pkgConfig = JSON.parse(fs.readFileSync(path.join(paths.nodeModules, pkgName, 'package.json'), 'utf8'));
			map[pkgName] = pkgConfig.version;
			return map;
		}, {});

	// Add those packages to package.json
	Object.assign(packageContents.dependencies, extraneous);
	fs.writeFileSync(paths.currentPackage, JSON.stringify(packageContents, null, 2));
}

exports.preserveExtraneousPlugins = preserveExtraneousPlugins;
