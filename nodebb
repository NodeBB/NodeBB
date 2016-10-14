#!/usr/bin/env node

try {
	var colors = require('colors'),
		cproc = require('child_process'),
		argv = require('minimist')(process.argv.slice(2)),
		fs = require('fs'),
		path = require('path'),
		request = require('request'),
		semver = require('semver'),
		prompt = require('prompt'),
		async = require('async');
} catch (e) {
	if (e.code === 'MODULE_NOT_FOUND') {
		process.stdout.write('NodeBB could not be started because it\'s dependencies have not been installed.\n');
		process.stdout.write('Please ensure that you have executed "npm install --production" prior to running NodeBB.\n\n');
		process.stdout.write('For more information, please see: https://docs.nodebb.org/en/latest/installing/os.html\n\n');
		process.stdout.write('Could not start: ' + e.code + '\n');

		process.exit(1);
	}
}

var getRunningPid = function(callback) {
		fs.readFile(__dirname + '/pidfile', {
			encoding: 'utf-8'
		}, function(err, pid) {
			if (err) {
				return callback(err);
			}

			try {
				process.kill(parseInt(pid, 10), 0);
				callback(null, parseInt(pid, 10));
			} catch(e) {
				callback(e);
			}
		});
	},
	getCurrentVersion = function(callback) {
		fs.readFile(path.join(__dirname, 'package.json'), { encoding: 'utf-8' }, function(err, pkg) {
			try {
				pkg = JSON.parse(pkg);
				return callback(null, pkg.version);
			} catch(err) {
				return callback(err);
			}
		})
	},
	fork = function (args) {
		cproc.fork('app.js', args, {
			cwd: __dirname,
			silent: false
		});
	},
	getInstalledPlugins = function(callback) {
		async.parallel({
			files: async.apply(fs.readdir, path.join(__dirname, 'node_modules')),
			deps: async.apply(fs.readFile, path.join(__dirname, 'package.json'), { encoding: 'utf-8' })
		}, function(err, payload) {
			var isNbbModule = /^nodebb-(?:plugin|theme|widget|rewards)-[\w\-]+$/,
				moduleName, isGitRepo;

			payload.files = payload.files.filter(function(file) {
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
			payload.files.forEach(function(moduleName) {
				try {
					fs.accessSync(path.join(__dirname, 'node_modules/' + moduleName, '.git'));
					isGitRepo = true;
				} catch(e) {
					isGitRepo = false;
				}

				if (
					payload.files.indexOf(moduleName) !== -1	// found in `node_modules/`
					&& payload.bundled.indexOf(moduleName) === -1	// not found in `package.json`
					&& !fs.lstatSync(path.join(__dirname, 'node_modules/' + moduleName)).isSymbolicLink()	// is not a symlink
					&& !isGitRepo	// .git/ does not exist, so it is not a git repository
				) {
					payload.installed.push(moduleName);
				}
			});

			getModuleVersions(payload.installed, callback);
		});
	},
	getModuleVersions = function(modules, callback) {
		var versionHash = {};

		async.eachLimit(modules, 50, function(module, next) {
			fs.readFile(path.join(__dirname, 'node_modules/' + module + '/package.json'), { encoding: 'utf-8' }, function(err, pkg) {
				try {
					pkg = JSON.parse(pkg);
					versionHash[module] = pkg.version;
					next();
				} catch (err) {
					next(err);
				}
			});
		}, function(err) {
			callback(err, versionHash);
		});
	},
	checkPlugins = function(standalone, callback) {
		if (standalone) {
			process.stdout.write('Checking installed plugins and themes for updates... ');
		}

		async.waterfall([
			async.apply(async.parallel, {
				plugins: async.apply(getInstalledPlugins),
				version: async.apply(getCurrentVersion)
			}),
			function(payload, next) {
				var toCheck = Object.keys(payload.plugins);

				if (!toCheck.length) {
					process.stdout.write('OK'.green + '\n'.reset);
					return next(null, []);	// no extraneous plugins installed
				}

				request({
					method: 'GET',
					url: 'https://packages.nodebb.org/api/v1/suggest?version=' + payload.version + '&package[]=' + toCheck.join('&package[]='),
					json: true
				}, function(err, res, body) {
					if (err) {
						process.stdout.write('error'.red + '\n'.reset);
						return next(err);
					}
					process.stdout.write('OK'.green + '\n'.reset);

					if (!Array.isArray(body) && toCheck.length === 1) {
						body = [body];
					}

					var current, suggested,
						upgradable = body.map(function(suggestObj) {
							current = payload.plugins[suggestObj.package];
							suggested = suggestObj.version;

							if (suggestObj.code === 'match-found' && semver.gt(suggested, current)) {
								return {
									name: suggestObj.package,
									current: current,
									suggested: suggested
								}
							} else {
								return null;
							}
						}).filter(Boolean);

					next(null, upgradable);
				})
			}
		], callback);
	},
	upgradePlugins = function(callback) {
		var standalone = false;
		if (typeof callback !== 'function') {
			callback = function() {};
			standalone = true;
		};

		checkPlugins(standalone, function(err, found) {
			if (err) {
				process.stdout.write('\Warning'.yellow + ': An unexpected error occured when attempting to verify plugin upgradability\n'.reset);
				return callback(err);
			}

			if (found && found.length) {
				process.stdout.write('\nA total of ' + new String(found.length).bold + ' package(s) can be upgraded:\n');
				found.forEach(function(suggestObj) {
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
				type: 'string'
			}, function(err, result) {
				if (['y', 'Y', 'yes', 'YES'].indexOf(result.upgrade) !== -1) {
					process.stdout.write('\nUpgrading packages...');
					var args = ['npm', 'i'];
					found.forEach(function(suggestObj) {
						args.push(suggestObj.name + '@' + suggestObj.suggested);
					});

					require('child_process').execFile('/usr/bin/env', args, { stdio: 'ignore' }, function(err) {
						if (!err) {
							process.stdout.write(' OK\n'.green);
						}

						callback(err);
					});
				} else {
					process.stdout.write('\nPackage upgrades skipped'.yellow + '. Check for upgrades at any time by running "'.reset + './nodebb upgrade-plugins'.green + '".\n'.reset);
					callback();
				}
			})
		});
	};

switch(process.argv[2]) {
	case 'status':
		getRunningPid(function(err, pid) {
			if (!err) {
				process.stdout.write('\nNodeBB Running '.bold + '(pid '.cyan + pid.toString().cyan + ')\n'.cyan);
				process.stdout.write('\t"' + './nodebb stop'.yellow + '" to stop the NodeBB server\n');
				process.stdout.write('\t"' + './nodebb log'.yellow + '" to view server output\n');
				process.stdout.write('\t"' + './nodebb restart'.yellow + '" to restart NodeBB\n\n');
			} else {
				process.stdout.write('\nNodeBB is not running\n'.bold);
				process.stdout.write('\t"' + './nodebb start'.yellow + '" to launch the NodeBB server\n\n'.reset);
			}
		})
		break;

	case 'start':
		process.stdout.write('\nStarting NodeBB\n'.bold);
		process.stdout.write('  "' + './nodebb stop'.yellow + '" to stop the NodeBB server\n');
		process.stdout.write('  "' + './nodebb log'.yellow + '" to view server output\n');
		process.stdout.write('  "' + './nodebb restart'.yellow + '" to restart NodeBB\n\n'.reset);

		// Spawn a new NodeBB process
		cproc.fork(__dirname + '/loader.js', {
			env: process.env
		});
		break;

	case 'stop':
		getRunningPid(function(err, pid) {
			if (!err) {
				process.kill(pid, 'SIGTERM');
				process.stdout.write('Stopping NodeBB. Goodbye!\n')
			} else {
				process.stdout.write('NodeBB is already stopped.\n');
			}
		});
		break;

	case 'restart':
		getRunningPid(function(err, pid) {
			if (!err) {
				process.kill(pid, 'SIGHUP');
				process.stdout.write('\nRestarting NodeBB\n'.bold);
			} else {
				process.stdout.write('NodeBB could not be restarted, as a running instance could not be found.\n');
			}
		});
		break;

	case 'reload':
		getRunningPid(function(err, pid) {
			if (!err) {
				process.kill(pid, 'SIGUSR2');
			} else {
				process.stdout.write('NodeBB could not be reloaded, as a running instance could not be found.\n');
			}
		});
		break;

	case 'dev':
		process.env.NODE_ENV = 'development';
		cproc.fork(__dirname + '/loader.js', ['--no-daemon', '--no-silent'], {
			env: process.env
		});
		break;

	case 'log':
		process.stdout.write('\nType '.red + 'Ctrl-C '.bold + 'to exit'.red);
		process.stdout.write('\n\n'.reset);
		cproc.spawn('tail', ['-F', './logs/output.log'], {
			cwd: __dirname,
			stdio: 'inherit'
		});
		break;

	case 'setup':
		cproc.fork('app.js', ['--setup'], {
			cwd: __dirname,
			silent: false
		});
		break;

	case 'reset':
		var args = process.argv.slice(0);
		args.unshift('--reset');
		fork(args);
		break;

	case 'activate':
		var args = process.argv.slice(0);
		args.unshift('--activate');
		fork(args);
		break;

	case 'plugins':
		var args = process.argv.slice(0);
		args.unshift('--plugins');
		fork(args);
		break;

	case 'upgrade-plugins':
		upgradePlugins();
		break;

	case 'upgrade':
		async.series([
			function(next) {
				process.stdout.write('1. '.bold + 'Bringing base dependencies up to date... '.yellow);
				require('child_process').execFile('/usr/bin/env', ['npm', 'i', '--production'], { stdio: 'ignore' }, next);
			},
			function(next) {
				process.stdout.write('OK\n'.green);
				process.stdout.write('2. '.bold + 'Checking installed plugins for updates... '.yellow);
				upgradePlugins(next);
			},
			function(next) {
				process.stdout.write('3. '.bold + 'Updating NodeBB data store schema...\n'.yellow);
				var upgradeProc = cproc.fork('app.js', ['--upgrade'], {
					cwd: __dirname,
					silent: false
				});

				upgradeProc.on('close', next)
			}
		], function(err) {
			if (err) {
				process.stdout.write('\nError'.red + ': ' + err.message + '\n');
			} else {
				var message = 'NodeBB Upgrade Complete!';
				// some consoles will return undefined/zero columns, so just use 2 spaces in upgrade script if we can't get our column count
				var columns = process.stdout.columns;
				var spaces = columns ? new Array(Math.floor(columns / 2) - (message.length / 2) + 1).join(' ') : "  ";

				process.stdout.write('OK\n'.green);
				process.stdout.write('\n' + spaces + message.green.bold + '\n\n'.reset);
			}
		});
		break;

	default:
		process.stdout.write('\nWelcome to NodeBB\n\n'.bold);
		process.stdout.write('Usage: ./nodebb {start|stop|reload|restart|log|setup|reset|upgrade|dev}\n\n');
		process.stdout.write('\t' + 'start'.yellow + '\tStart the NodeBB server\n');
		process.stdout.write('\t' + 'stop'.yellow + '\tStops the NodeBB server\n');
		process.stdout.write('\t' + 'reload'.yellow + '\tRestarts NodeBB\n');
		process.stdout.write('\t' + 'restart'.yellow + '\tRestarts NodeBB\n');
		process.stdout.write('\t' + 'log'.yellow + '\tOpens the logging interface (useful for debugging)\n');
		process.stdout.write('\t' + 'setup'.yellow + '\tRuns the NodeBB setup script\n');
		process.stdout.write('\t' + 'reset'.yellow + '\tDisables all plugins, restores the default theme.\n');
		process.stdout.write('\t' + 'activate'.yellow + '\tActivate a plugin on start up.\n');
		process.stdout.write('\t' + 'plugins'.yellow + '\tList all plugins that have been installed.\n');
		process.stdout.write('\t' + 'upgrade'.yellow + '\tRun NodeBB upgrade scripts, ensure packages are up-to-date\n');
		process.stdout.write('\t' + 'dev'.yellow + '\tStart NodeBB in interactive development mode\n');
		process.stdout.write('\n'.reset);
		break;
}
