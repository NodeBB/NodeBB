'use strict';

var fs = require('fs');
var path = require('path');

var packageInstall = require('./package-install');
var dirname = require('./paths').baseDir;

// check to make sure dependencies are installed
try {
	fs.accessSync(path.join(dirname, 'package.json'), fs.constants.R_OK);
} catch (e) {
	if (e.code === 'ENOENT') {
		console.warn('package.json not found.');
		console.log('Populating package.json...');

		packageInstall.updatePackageFile();
		packageInstall.preserveExtraneousPlugins();

		try {
			fs.accessSync(path.join(dirname, 'node_modules/colors/package.json'), fs.constants.R_OK);

			require('colors');
			console.log('OK'.green);
		} catch (e) {
			console.log('OK');
		}
	} else {
		throw e;
	}
}

try {
	fs.accessSync(path.join(dirname, 'node_modules/semver/package.json'), fs.constants.R_OK);

	var semver = require('semver');
	var defaultPackage = require('../../install/package.json');

	var checkVersion = function (packageName) {
		var version = JSON.parse(fs.readFileSync(path.join(dirname, 'node_modules', packageName, 'package.json'), 'utf8')).version;
		if (!semver.satisfies(version, defaultPackage.dependencies[packageName])) {
			var e = new TypeError('Incorrect dependency version: ' + packageName);
			e.code = 'DEP_WRONG_VERSION';
			throw e;
		}
	};

	checkVersion('nconf');
	checkVersion('async');
	checkVersion('commander');
	checkVersion('colors');
} catch (e) {
	if (['ENOENT', 'DEP_WRONG_VERSION', 'MODULE_NOT_FOUND'].indexOf(e.code) !== -1) {
		console.warn('Dependencies outdated or not yet installed.');
		console.log('Installing them now...\n');

		packageInstall.updatePackageFile();
		packageInstall.installAll();

		require('colors');
		console.log('OK'.green + '\n'.reset);
	} else {
		throw e;
	}
}

require('colors');
var nconf = require('nconf');
var program = require('commander');

var pkg = require('../../package.json');
var file = require('../file');
var prestart = require('../prestart');

program
	.name('./nodebb')
	.description('Welcome to NodeBB')
	.version(pkg.version)
	.option('--json-logging', 'Output to logs in JSON format', false)
	.option('--log-level <level>', 'Default logging level to use', 'info')
	.option('-d, --dev', 'Development mode, including verbose logging', false)
	.option('-l, --log', 'Log subprocess output to console', false)
	.option('-c, --config <value>', 'Specify a config file', 'config.json')
	.parse(process.argv);

nconf.argv().env({
	separator: '__',
});

var env = program.dev ? 'development' : (process.env.NODE_ENV || 'production');
process.env.NODE_ENV = env;
global.env = env;

prestart.setupWinston();

// Alternate configuration file support
var	configFile = path.resolve(dirname, program.config);
var configExists = file.existsSync(configFile) || (nconf.get('url') && nconf.get('secret') && nconf.get('database'));

prestart.loadConfig(configFile);
prestart.versionCheck();

if (!configExists && process.argv[2] !== 'setup') {
	require('./setup').webInstall();
	return;
}

process.env.CONFIG = configFile;

// running commands
program
	.command('start')
	.description('Start the NodeBB server')
	.action(function () {
		require('./running').start(program);
	});
program
	.command('slog', null, {
		noHelp: true,
	})
	.description('Start the NodeBB server and view the live output log')
	.action(function () {
		program.log = true;
		require('./running').start(program);
	});
program
	.command('dev', null, {
		noHelp: true,
	})
	.description('Start NodeBB in verbose development mode')
	.action(function () {
		program.dev = true;
		process.env.NODE_ENV = 'development';
		global.env = 'development';
		require('./running').start(program);
	});
program
	.command('stop')
	.description('Stop the NodeBB server')
	.action(function () {
		require('./running').stop(program);
	});
program
	.command('restart')
	.description('Restart the NodeBB server')
	.action(function () {
		require('./running').restart(program);
	});
program
	.command('status')
	.description('Check the running status of the NodeBB server')
	.action(function () {
		require('./running').status(program);
	});
program
	.command('log')
	.description('Open the output log (useful for debugging)')
	.action(function () {
		require('./running').log(program);
	});

// management commands
program
	.command('setup [config]')
	.description('Run the NodeBB setup script, or setup with an initial config')
	.action(function (initConfig) {
		if (initConfig) {
			try {
				initConfig = JSON.parse(initConfig);
			} catch (e) {
				console.warn('Invalid JSON passed as initial config value.'.red);
				console.log('If you meant to pass in an initial config value, please try again.\n');

				throw e;
			}
		}
		require('./setup').setup(initConfig);
	});

program
	.command('install')
	.description('Launch the NodeBB web installer for configuration setup')
	.action(function () {
		require('./setup').webInstall();
	});
program
	.command('build [targets...]')
	.description('Compile static assets ' + '(JS, CSS, templates, languages, sounds)'.red)
	.option('-s, --series', 'Run builds in series without extra processes')
	.action(function (targets, options) {
		require('./manage').build(targets.length ? targets : true, options);
	})
	.on('--help', function () {
		require('./manage').buildTargets();
	});
program
	.command('activate [plugin]')
	.description('Activate a plugin for the next startup of NodeBB (nodebb-plugin- prefix is optional)')
	.action(function (plugin) {
		require('./manage').activate(plugin);
	});
program
	.command('plugins')
	.action(function () {
		require('./manage').listPlugins();
	})
	.description('List all installed plugins');
program
	.command('events')
	.description('Outputs the last ten (10) administrative events recorded by NodeBB')
	.action(function () {
		require('./manage').listEvents();
	});
program
	.command('info')
	.description('Outputs various system info')
	.action(function () {
		require('./manage').info();
	});

// reset
var resetCommand = program.command('reset');

resetCommand
	.description('Reset plugins, themes, settings, etc')
	.option('-t, --theme [theme]', 'Reset to [theme] or to the default theme')
	.option('-p, --plugin [plugin]', 'Disable [plugin] or all plugins')
	.option('-w, --widgets', 'Disable all widgets')
	.option('-s, --settings', 'Reset settings to their default values')
	.option('-a, --all', 'All of the above')
	.action(function (options) {
		var valid = ['theme', 'plugin', 'widgets', 'settings', 'all'].some(function (x) {
			return options[x];
		});
		if (!valid) {
			console.warn('\n  No valid options passed in, so nothing was reset.'.red);
			resetCommand.help();
		}

		require('./reset').reset(options, function (err) {
			if (err) { throw err; }
			require('../meta/build').buildAll(function (err) {
				if (err) { throw err; }

				process.exit();
			});
		});
	});

// upgrades
program
	.command('upgrade [scripts...]')
	.description('Run NodeBB upgrade scripts and ensure packages are up-to-date, or run a particular upgrade script')
	.option('-m, --package', 'Update package.json from defaults', false)
	.option('-i, --install', 'Bringing base dependencies up to date', false)
	.option('-p, --plugins', 'Check installed plugins for updates', false)
	.option('-s, --schema', 'Update NodeBB data store schema', false)
	.option('-b, --build', 'Rebuild assets', false)
	.on('--help', function () {
		console.log('\n' + [
			'When running particular upgrade scripts, options are ignored.',
			'By default all options are enabled. Passing any options disables that default.',
			'Only package and dependency updates: ' + './nodebb upgrade -mi'.yellow,
			'Only database update: ' + './nodebb upgrade -s'.yellow,
		].join('\n'));
	})
	.action(function (scripts, options) {
		require('./upgrade').upgrade(scripts.length ? scripts : true, options);
	});

program
	.command('upgrade-plugins', null, {
		noHelp: true,
	})
	.alias('upgradePlugins')
	.description('Upgrade plugins')
	.action(function () {
		require('./upgrade-plugins').upgradePlugins(function (err) {
			if (err) {
				throw err;
			}
			console.log('OK'.green);
			process.exit();
		});
	});

program
	.command('help [command]')
	.description('Display help for [command]')
	.action(function (name) {
		if (!name) {
			return program.help();
		}

		var command = program.commands.find(function (command) { return command._name === name; });
		if (command) {
			command.help();
		} else {
			program.help();
		}
	});

require('./colors');

if (process.argv.length === 2) {
	program.help();
}

program.executables = false;

program.parse(process.argv);
