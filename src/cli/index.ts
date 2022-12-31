/* eslint-disable import/order */

'use strict';

import path from 'path';
import chalk from 'chalk';
import nconf from 'nconf';
import { program } from 'commander';
import yargs from 'yargs';

import pkg from '../../../install/package.json';
import file from '../file';
import * as prestart from '../prestart';

program.configureHelp(require('./colors'));

program
	.name('./nodebb')
	.description('Welcome to NodeBB')
	.version(pkg.version)
	.option('--json-logging', 'Output to logs in JSON format', false)
	.option('--log-level <level>', 'Default logging level to use', 'info')
	.option('--config <value>', 'Specify a config file', 'config.json')
	.option('-d, --dev', 'Development mode, including verbose logging', false)
	.option('-l, --log', 'Log subprocess output to console', false);

// provide a yargs object ourselves
// otherwise yargs will consume `--help` or `help`
// and `nconf` will exit with useless usage info
const opts = yargs(process.argv.slice(2)).help(false).exitProcess(false);
nconf.argv(opts).env({
	separator: '__',
});

process.env.NODE_ENV = process.env.NODE_ENV || 'production';
global.env = process.env.NODE_ENV || 'production';

prestart.setupWinston();

// Alternate configuration file support
const configFile = path.resolve(paths.baseDir, nconf.get('config') || 'config.json');
const configExists = file.existsSync(configFile) || (nconf.get('url') && nconf.get('secret') && nconf.get('database'));

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
	.action(() => {
		require('./running').start(program.opts());
	});
program
	.command('slog', null, {
		noHelp: true,
	})
	.description('Start the NodeBB server and view the live output log')
	.action(() => {
		require('./running').start({ ...program.opts(), log: true });
	});
program
	.command('dev', null, {
		noHelp: true,
	})
	.description('Start NodeBB in verbose development mode')
	.action(() => {
		process.env.NODE_ENV = 'development';
		global.env = 'development';
		require('./running').start({ ...program.opts(), dev: true });
	});
program
	.command('stop')
	.description('Stop the NodeBB server')
	.action(() => {
		require('./running').stop(program.opts());
	});
program
	.command('restart')
	.description('Restart the NodeBB server')
	.action(() => {
		require('./running').restart(program.opts());
	});
program
	.command('status')
	.description('Check the running status of the NodeBB server')
	.action(() => {
		require('./running').status(program.opts());
	});
program
	.command('log')
	.description('Open the output log (useful for debugging)')
	.action(() => {
		require('./running').log(program.opts());
	});

// management commands
program
	.command('setup [config]')
	.description('Run the NodeBB setup script, or setup with an initial config')
	.option('--skip-build', 'Run setup without building assets')
	.action((initConfig) => {
		console.log('INIT CONFIG', initConfig);
		if (initConfig) {
			try {
				initConfig = JSON.parse(initConfig);
		} catch (e: any) {				console.warn(chalk.red('Invalid JSON passed as initial config value.'));
				console.log('If you meant to pass in an initial config value, please try again.\n');

				throw e;
			}
		}
		require('./setup').setup(initConfig);
	});

program
	.command('install [plugin]')
	.description('Launch the NodeBB web installer for configuration setup or install a plugin')
	.option('-f, --force', 'Force plugin installation even if it may be incompatible with currently installed NodeBB version')
	.action((plugin, options) => {
		if (plugin) {
			require('./manage').install(plugin, options);
		} else {
			require('./setup').webInstall();
		}
	});

program
	.command('build [targets...]')
	.description(`Compile static assets ${chalk.red('(JS, CSS, templates, languages)')}`)
	.option('-s, --series', 'Run builds in series without extra processes')
	.option('-w, --webpack', 'Bundle assets with webpack', true)
	.action((targets, options) => {
		console.log('HEYYYYY!!!!!!!!!!!');
		if (program.opts().dev) {
			process.env.NODE_ENV = 'development';
			global.env = 'development';
		}
		require('./manage').build(targets.length ? targets : true, options);
	})
	.on('--help', () => {
		require('../meta/aliases').buildTargets();
	});
program
	.command('activate [plugin]')
	.description('Activate a plugin for the next startup of NodeBB (nodebb-plugin- prefix is optional)')
	.action((plugin) => {
		require('./manage').activate(plugin);
	});
program
	.command('plugins')
	.action(() => {
		require('./manage').listPlugins();
	})
	.description('List all installed plugins');
program
	.command('events [count]')
	.description('Outputs the most recent administrative events recorded by NodeBB')
	.action((count) => {
		require('./manage').listEvents(count);
	});
program
	.command('info')
	.description('Outputs various system info')
	.action(() => {
		require('./manage').info();
	});

// reset
const resetCommand = program.command('reset');

resetCommand
	.description('Reset plugins, themes, settings, etc')
	.option('-t, --theme [theme]', 'Reset to [theme] or to the default theme')
	.option('-p, --plugin [plugin]', 'Disable [plugin] or all plugins')
	.option('-w, --widgets', 'Disable all widgets')
	.option('-s, --settings', 'Reset settings to their default values')
	.option('-a, --all', 'All of the above')
	.action((options) => {
		const valid = ['theme', 'plugin', 'widgets', 'settings', 'all'].some(x => options[x]);
		if (!valid) {
			console.warn(`\n${chalk.red('No valid options passed in, so nothing was reset.')}`);
			resetCommand.help();
		}

		require('./reset').reset(options, (err) => {
			if (err) {
				return process.exit(1);
			}

			process.exit(0);
		});
	});

// user
program
	.addCommand(require('./user')());

// upgrades
program
	.command('upgrade [scripts...]')
	.description('Run NodeBB upgrade scripts and ensure packages are up-to-date, or run a particular upgrade script')
	.option('-m, --package', 'Update package.json from defaults', false)
	.option('-i, --install', 'Bringing base dependencies up to date', false)
	.option('-p, --plugins', 'Check installed plugins for updates', false)
	.option('-s, --schema', 'Update NodeBB data store schema', false)
	.option('-b, --build', 'Rebuild assets', false)
	.on('--help', () => {
		console.log(`\n${[
			'When running particular upgrade scripts, options are ignored.',
			'By default all options are enabled. Passing any options disables that default.',
			'\nExamples:',
			`  Only package and dependency updates: ${chalk.yellow('./nodebb upgrade -mi')}`,
			`  Only database update: ${chalk.yellow('./nodebb upgrade -s')}`,
		].join('\n')}`);
	})
	.action((scripts, options) => {
		if (program.opts().dev) {
			process.env.NODE_ENV = 'development';
			global.env = 'development';
		}
		require('./upgrade').upgrade(scripts.length ? scripts : true, options);
	});

program
	.command('upgrade-plugins', null, {
		noHelp: true,
	})
	.alias('upgradePlugins')
	.description('Upgrade plugins')
	.action(() => {
		require('./upgrade-plugins').upgradePlugins((err) => {
			if (err) {
				throw err;
			}
			console.log(chalk.green('OK'));
			process.exit();
		});
	});

program
	.command('help [command]')
	.description('Display help for [command]')
	.action((name) => {
		if (!name) {
			return program.help();
		}

		const command = program.commands.find(command => command._name === name);
		if (command) {
			command.help();
		} else {
			console.log(`error: unknown command '${command}'.`);
			program.help();
		}
	});

if (process.argv.length === 2) {
	program.help();
}

program.executables = false;

program.parse();
