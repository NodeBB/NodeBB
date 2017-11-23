'use strict';

var async = require('async');
var prompt = require('prompt');
var request = require('request');
var cproc = require('child_process');
var semver = require('semver');
var fs = require('fs');
var path = require('path');

var paths = require('./paths');

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
	}, function (err, payload) {
		if (err) {
			return callback(err);
		}

		var isNbbModule = /^nodebb-(?:plugin|theme|widget|rewards)-[\w-]+$/;
		var moduleName;
		var isGitRepo;

		payload.files = payload.files.filter(function (file) {
			return isNbbModule.test(file);
		});

		try {
			payload.deps = JSON.parse(payload.deps).dependencies;
			payload.bundled = [];
			payload.installed = [];
		} catch (err) {
			return callback(err);
		}

		for (moduleName in payload.deps) {
			if (isNbbModule.test(moduleName)) {
				payload.bundled.push(moduleName);
			}
		}

		// Whittle down deps to send back only extraneously installed plugins/themes/etc
		payload.files.forEach(function (moduleName) {
			try {
				fs.accessSync(path.join(dirname, 'node_modules', moduleName, '.git'));
				isGitRepo = true;
			} catch (e) {
				isGitRepo = false;
			}

			if (
				payload.files.indexOf(moduleName) !== -1 &&	// found in `node_modules/`
				payload.bundled.indexOf(moduleName) === -1 &&	// not found in `package.json`
				!fs.lstatSync(path.join(dirname, 'node_modules', moduleName)).isSymbolicLink() &&	// is not a symlink
				!isGitRepo	// .git/ does not exist, so it is not a git repository
			) {
				payload.installed.push(moduleName);
			}
		});

		getModuleVersions(payload.installed, callback);
	});
}

function getCurrentVersion(callback) {
	fs.readFile(path.join(dirname, 'package.json'), { encoding: 'utf-8' }, function (err, pkg) {
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
			plugins: async.apply(getInstalledPlugins),
			version: async.apply(getCurrentVersion),
		}),
		function (payload, next) {
			var toCheck = Object.keys(payload.plugins);

			if (!toCheck.length) {
				process.stdout.write('OK'.green + '\n'.reset);
				return next(null, []);	// no extraneous plugins installed
			}

			request({
				method: 'GET',
				url: 'https://packages.nodebb.org/api/v1/suggest?version=' + payload.version + '&package[]=' + toCheck.join('&package[]='),
				json: true,
			}, function (err, res, body) {
				if (err) {
					process.stdout.write('error'.red + '\n'.reset);
					return next(err);
				}
				process.stdout.write('OK'.green + '\n'.reset);

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
			process.stdout.write('Warning'.yellow + ': An unexpected error occured when attempting to verify plugin upgradability\n'.reset);
			return callback(err);
		}

		if (found && found.length) {
			process.stdout.write('\nA total of ' + String(found.length).bold + ' package(s) can be upgraded:\n');
			found.forEach(function (suggestObj) {
				process.stdout.write('  * '.yellow + suggestObj.name.reset + ' (' + suggestObj.current.yellow + ' -> '.reset + suggestObj.suggested.green + ')\n'.reset);
			});
			process.stdout.write('\n');
		} else {
			if (standalone) {
				process.stdout.write('\nAll packages up-to-date!'.green + '\n'.reset);
			}
			return callback();
		}

		prompt.message = '';
		prompt.delimiter = '';

		prompt.start();
		prompt.get({
			name: 'upgrade',
			description: 'Proceed with upgrade (y|n)?'.reset,
			type: 'string',
		}, function (err, result) {
			if (err) {
				return callback(err);
			}

			if (['y', 'Y', 'yes', 'YES'].indexOf(result.upgrade) !== -1) {
				process.stdout.write('\nUpgrading packages...');
				var args = ['i'];
				found.forEach(function (suggestObj) {
					args.push(suggestObj.name + '@' + suggestObj.suggested);
				});

				cproc.execFile((process.platform === 'win32') ? 'npm.cmd' : 'npm', args, { stdio: 'ignore' }, callback);
			} else {
				process.stdout.write('\nPackage upgrades skipped'.yellow + '. Check for upgrades at any time by running "'.reset + './nodebb upgrade-plugins'.green + '".\n'.reset);
				callback();
			}
		});
	});
}

exports.upgradePlugins = upgradePlugins;
