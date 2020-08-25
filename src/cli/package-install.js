'use strict';

const path = require('path');
const fs = require('fs');
const cproc = require('child_process');

const packageFilePath = path.join(__dirname, '../../package.json');
const packageDefaultFilePath = path.join(__dirname, '../../install/package.json');
const modulesPath = path.join(__dirname, '../../node_modules');

const isPackage = /^(@\w+\/)?nodebb-(plugin|theme|widget|reward)-\w+/;

function updatePackageFile() {
	let oldPackageContents = {};

	try {
		oldPackageContents = JSON.parse(fs.readFileSync(packageFilePath, 'utf8'));
	} catch (e) {
		if (e.code !== 'ENOENT') {
			throw e;
		}
	}

	const defaultPackageContents = JSON.parse(fs.readFileSync(packageDefaultFilePath, 'utf8'));

	let dependencies = {};
	Object.entries(oldPackageContents.dependencies || {}).forEach(([dep, version]) => {
		if (isPackage.test(dep)) {
			dependencies[dep] = version;
		}
	});

	// Sort dependencies alphabetically
	dependencies = Object.entries({ ...dependencies, ...defaultPackageContents.dependencies }).sort((a, b) => (a < b ? -1 : 1)).reduce((memo, pkg) => {
		memo[pkg[0]] = pkg[1];
		return memo;
	}, {});

	const packageContents = { ...oldPackageContents, ...defaultPackageContents, dependencies: dependencies };

	fs.writeFileSync(packageFilePath, JSON.stringify(packageContents, null, 2));
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
		fs.accessSync(path.join(modulesPath, 'nconf/package.json'), fs.constants.R_OK);
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
		fs.accessSync(modulesPath, fs.constants.R_OK);
	} catch (e) {
		return;
	}

	const packages = fs.readdirSync(modulesPath).filter(function (pkgName) {
		return isPackage.test(pkgName);
	});
	const packageContents = JSON.parse(fs.readFileSync(packageFilePath, 'utf8'));

	const extraneous = packages
		// only extraneous plugins (ones not in package.json) which are not links
		.filter(function (pkgName) {
			const extraneous = !packageContents.dependencies.hasOwnProperty(pkgName);
			const isLink = fs.lstatSync(path.join(modulesPath, pkgName)).isSymbolicLink();

			return extraneous && !isLink;
		})
		// reduce to a map of package names to package versions
		.reduce(function (map, pkgName) {
			const pkgConfig = JSON.parse(fs.readFileSync(path.join(modulesPath, pkgName, 'package.json'), 'utf8'));
			map[pkgName] = pkgConfig.version;
			return map;
		}, {});

	// Add those packages to package.json
	Object.assign(packageContents.dependencies, extraneous);
	fs.writeFileSync(packageFilePath, JSON.stringify(packageContents, null, 2));
}

exports.preserveExtraneousPlugins = preserveExtraneousPlugins;
