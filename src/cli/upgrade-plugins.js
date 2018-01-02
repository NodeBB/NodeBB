'use strict';

var async = require('async');
var prompt = require('prompt');
var request = require('request');
var cproc = require('child_process');
var semver = require('semver');
var fs = require('fs');
var path = require('path');
var nconf = require('nconf');

var paths = require('./paths');

var packageManager = nconf.get('package_manager');
var packageManagerExecutable = packageManager === 'yarn' ? 'yarn' : 'npm';
var packageManagerInstallArgs = packageManager === 'yarn' ? ['add'] : ['install', '--save'];

if (process.platform === 'win32') {
	packageManagerExecutable += '.cmd';
}

var dirname = paths.baseDir;

function getModuleVersions(modules, callback) {
	var versionHash = {};

	async.eachLimit(modules, 50, function (module, next) {
		fs.readFile(path.join(dirname, 'node_modules', module, 'package.json'), { encoding: 'utf-8' }, function (err, pkg) {
			if (err) {
				return next(err);
			}

			try {
				pkg = JSON.parse(pkg);
				versionHash[module] = pkg.version;
				next();
			} catch (err) {
				next(err);
			}
		});
	}, function (err) {
		callback(err, versionHash);
	});
}

function getInstalledPlugins(callback) {
	async.parallel({
		files: async.apply(fs.readdir, path.join(dirname, 'node_modules')),
		deps: async.apply(fs.readFile, path.join(dirname, 'package.json'), { encoding: 'utf-8' }),
		bundled: async.apply(fs.readFile, path.join(dirname, 'install/package.json'), { encoding: 'utf-8' }),
	}, function (err, payload) {
		if (err) {
			return callback(err);
		}

		var isNbbModule = /^nodebb-(?:plugin|theme|widget|rewards)-[\w-]+$/;
		var checklist;

		payload.files = payload.files.filter(function (file) {
			return isNbbModule.test(file);
		});

		try {
			payload.deps = Object.keys(JSON.parse(payload.deps).dependencies);
			payload.bundled = Object.keys(JSON.parse(payload.bundled).dependencies);
		} catch (err) {
			return callback(err);
		}

		payload.bundled = payload.bundled.filter(function (pkgName) {
			return isNbbModule.test(pkgName);
		});
		payload.deps = payload.deps.filter(function (pkgName) {
			return isNbbModule.test(pkgName);
		});

		// Whittle down deps to send back only extraneously installed plugins/themes/etc
		checklist = payload.deps.filter(function (pkgName) {
			if (payload.bundled.includes(pkgName)) {
				return false;
			}

			// Ignore git repositories
			try {
				fs.accessSync(path.join(dirname, 'node_modules', pkgName, '.git'));
				return false;
			} catch (e) {
				return true;
			}
		});

		getModuleVersions(checklist, callback);
	});
}

function getCurrentVersion(callback) {
	fs.readFile(path.join(dirname, 'install/package.json'), { encoding: 'utf-8' }, function (err, pkg) {
		if (err) {
			return callback(err);
		}

		try {
			pkg = JSON.parse(pkg);
		} catch (err) {
			return callback(err);
		}
		callback(null, pkg.version);
	});
}

function checkPlugins(standalone, callback) {
	if (standalone) {
		process.stdout.write('Checking installed plugins and themes for updates... ');
	}

	async.waterfall([
		async.apply(async.parallel, {
			plugins: getInstalledPlugins,
			version: getCurrentVersion,
		}),
		function (payload, next) {
			var toCheck = Object.keys(payload.plugins);

			if (!toCheck.length) {
				process.stdout.write('  OK'.green + ''.reset);
				return next(null, []);	// no extraneous plugins installed
			}

			request({
				method: 'GET',
				url: 'https://packages.nodebb.org/api/v1/suggest?version=' + payload.version + '&package[]=' + toCheck.join('&package[]='),
				json: true,
			}, function (err, res, body) {
				if (err) {
					process.stdout.write('error'.red + ''.reset);
					return next(err);
				}
				process.stdout.write('  OK'.green + ''.reset);

				if (!Array.isArray(body) && toCheck.length === 1) {
					body = [body];
				}

				var current;
				var suggested;
				var upgradable = body.map(function (suggestObj) {
					current = payload.plugins[suggestObj.package];
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

				next(null, upgradable);
			});
		},
	], callback);
}

function upgradePlugins(callback) {
	var standalone = false;
	if (typeof callback !== 'function') {
		callback = function () {};
		standalone = true;
	}

	checkPlugins(standalone, function (err, found) {
		if (err) {
			console.log('Warning'.yellow + ': An unexpected error occured when attempting to verify plugin upgradability'.reset);
			return callback(err);
		}

		if (found && found.length) {
			process.stdout.write('\n\nA total of ' + String(found.length).bold + ' package(s) can be upgraded:\n\n');
			found.forEach(function (suggestObj) {
				process.stdout.write('  * '.yellow + suggestObj.name.reset + ' (' + suggestObj.current.yellow + ' -> '.reset + suggestObj.suggested.green + ')\n'.reset);
			});
		} else {
			if (standalone) {
				console.log('\nAll packages up-to-date!'.green + ''.reset);
			}
			return callback();
		}

		prompt.message = '';
		prompt.delimiter = '';

		prompt.start();
		prompt.get({
			name: 'upgrade',
			description: '\nProceed with upgrade (y|n)?'.reset,
			type: 'string',
		}, function (err, result) {
			if (err) {
				return callback(err);
			}

			if (['y', 'Y', 'yes', 'YES'].indexOf(result.upgrade) !== -1) {
				console.log('\nUpgrading packages...');
				var args = packageManagerInstallArgs.concat(found.map(function (suggestObj) {
					return suggestObj.name + '@' + suggestObj.suggested;
				}));

				cproc.execFile(packageManagerExecutable, args, { stdio: 'ignore' }, function (err) {
					callback(err, false);
				});
			} else {
				console.log('Package upgrades skipped'.yellow + '. Check for upgrades at any time by running "'.reset + './nodebb upgrade -p'.green + '".'.reset);
				callback();
			}
		});
	});
}

exports.upgradePlugins = upgradePlugins;
