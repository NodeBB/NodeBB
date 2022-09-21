'use strict';

const path = require('path');

const fs = require('fs');
const cproc = require('child_process');

const { paths, pluginNamePattern } = require('../constants');

const pkgInstall = module.exports;

function sortDependencies(dependencies) {
	return Object.entries(dependencies)
		.sort((a, b) => (a < b ? -1 : 1))
		.reduce((memo, pkg) => {
			memo[pkg[0]] = pkg[1];
			return memo;
		}, {});
}

pkgInstall.updatePackageFile = () => {
	let oldPackageContents;

	try {
		oldPackageContents = JSON.parse(fs.readFileSync(paths.currentPackage, 'utf8'));
	} catch (e) {
		if (e.code !== 'ENOENT') {
			throw e;
		} else {
			// No local package.json, copy from install/package.json
			fs.copyFileSync(paths.installPackage, paths.currentPackage);
			return;
		}
	}

	const _ = require('lodash');
	const defaultPackageContents = JSON.parse(fs.readFileSync(paths.installPackage, 'utf8'));

	let dependencies = {};
	Object.entries(oldPackageContents.dependencies || {}).forEach(([dep, version]) => {
		if (pluginNamePattern.test(dep)) {
			dependencies[dep] = version;
		}
	});

	const { devDependencies } = defaultPackageContents;

	// Sort dependencies alphabetically
	dependencies = sortDependencies({ ...dependencies, ...defaultPackageContents.dependencies });

	const packageContents = { ..._.merge(oldPackageContents, defaultPackageContents), dependencies, devDependencies };
	fs.writeFileSync(paths.currentPackage, JSON.stringify(packageContents, null, 4));
};

pkgInstall.supportedPackageManager = [
	'npm',
	'cnpm',
	'pnpm',
	'yarn',
];

pkgInstall.getPackageManager = () => {
	try {
		const packageContents = require(paths.currentPackage);
		// This regex technically allows invalid values:
		// cnpm isn't supported by corepack and it doesn't enforce a version string being present
		const pmRegex = new RegExp(`^(?<packageManager>${pkgInstall.supportedPackageManager.join('|')})@?[\\d\\w\\.\\-]*$`);
		const packageManager = packageContents.packageManager ? packageContents.packageManager.match(pmRegex) : false;
		if (packageManager) {
			return packageManager.groups.packageManager;
		}
		fs.accessSync(path.join(paths.nodeModules, 'nconf/package.json'), fs.constants.R_OK);
		const nconf = require('nconf');
		if (!Object.keys(nconf.stores).length) {
			// Quick & dirty nconf setup for when you cannot rely on nconf having been required already
			const configFile = path.resolve(__dirname, '../../', nconf.any(['config', 'CONFIG']) || 'config.json');
			nconf.env().file({ // not sure why adding .argv() causes the process to terminate
				file: configFile,
			});
		}
		if (nconf.get('package_manager') && !pkgInstall.supportedPackageManager.includes(nconf.get('package_manager'))) {
			nconf.clear('package_manager');
		}

		if (!nconf.get('package_manager')) {
			nconf.set('package_manager', getPackageManagerByLockfile());
		}

		return nconf.get('package_manager') || 'npm';
	} catch (e) {
		// nconf not installed or other unexpected error/exception
		return getPackageManagerByLockfile() || 'npm';
	}
};

function getPackageManagerByLockfile() {
	for (const [packageManager, lockfile] of Object.entries({ npm: 'package-lock.json', yarn: 'yarn.lock', pnpm: 'pnpm-lock.yaml' })) {
		try {
			fs.accessSync(path.resolve(__dirname, `../../${lockfile}`), fs.constants.R_OK);
			return packageManager;
		} catch (e) {}
	}
}

pkgInstall.installAll = () => {
	const prod = process.env.NODE_ENV !== 'development';
	let command = 'npm install';

	const supportedPackageManagerList = exports.supportedPackageManager; // load config from src/cli/package-install.js
	const packageManager = pkgInstall.getPackageManager();
	if (supportedPackageManagerList.indexOf(packageManager) >= 0) {
		switch (packageManager) {
			case 'yarn':
				command = `yarn${prod ? ' --production' : ''}`;
				break;
			case 'pnpm':
				command = 'pnpm install'; // pnpm checks NODE_ENV
				break;
			case 'cnpm':
				command = `cnpm install ${prod ? ' --production' : ''}`;
				break;
			default:
				command += prod ? ' --omit=dev' : '';
				break;
		}
	}

	try {
		cproc.execSync(command, {
			cwd: path.join(__dirname, '../../'),
			stdio: [0, 1, 2],
		});
	} catch (e) {
		console.log('Error installing dependencies!');
		console.log(`message: ${e.message}`);
		console.log(`stdout: ${e.stdout}`);
		console.log(`stderr: ${e.stderr}`);
		throw e;
	}
};

pkgInstall.preserveExtraneousPlugins = () => {
	// Skip if `node_modules/` is not found or inaccessible
	try {
		fs.accessSync(paths.nodeModules, fs.constants.R_OK);
	} catch (e) {
		return;
	}

	const packages = fs.readdirSync(paths.nodeModules)
		.filter(pkgName => pluginNamePattern.test(pkgName));

	const packageContents = JSON.parse(fs.readFileSync(paths.currentPackage, 'utf8'));

	const extraneous = packages
		// only extraneous plugins (ones not in package.json) which are not links
		.filter((pkgName) => {
			const extraneous = !packageContents.dependencies.hasOwnProperty(pkgName);
			const isLink = fs.lstatSync(path.join(paths.nodeModules, pkgName)).isSymbolicLink();

			return extraneous && !isLink;
		})
		// reduce to a map of package names to package versions
		.reduce((map, pkgName) => {
			const pkgConfig = JSON.parse(fs.readFileSync(path.join(paths.nodeModules, pkgName, 'package.json'), 'utf8'));
			map[pkgName] = pkgConfig.version;
			return map;
		}, {});

	// Add those packages to package.json
	packageContents.dependencies = sortDependencies({ ...packageContents.dependencies, ...extraneous });

	fs.writeFileSync(paths.currentPackage, JSON.stringify(packageContents, null, 4));
};
