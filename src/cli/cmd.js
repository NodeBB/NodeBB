'use strict';

var path = require('path');
var winston = require('winston');
var async = require('async');
var db = require('../database');
var plugins = require('../plugins/data');

function parseCommands(pluginList, callback) {
	var commands = [];

	pluginList.forEach((pluginData) => {
		var pluginCommands = pluginData.commands || [];

		pluginCommands.forEach((cmdData) => {
			var pluginName = pluginData.id;
			var cmdName = pluginName.replace('nodebb-plugin-', '') + ':' + cmdData.cmd;

			commands.push({
				plugin: pluginName,
				name: cmdName,
				description: cmdData.description,
				options: cmdData.options,
				action: (cmdArgs, done) => {
					var libraryFile = cmdData.library ? cmdData.library : pluginData.library;
					var scriptFile = path.resolve(pluginData.path, libraryFile);
					var call = require(scriptFile)[cmdData.method];
					call(cmdArgs, done);
				},
			});
		});
	});
	callback(null, commands);
}

function printCommandList(commands) {
	console.log('\n');
	if (commands.length) {
		commands.forEach((cmd) => {
			console.log('\x1b[32m' + cmd.name + '\x1b[0m \t\t\t ' + cmd.description);
		});
	} else {
		console.log('\x1b[31m No commands available \x1b[0m');
	}
	console.log('\n');
}

function registerPluginCommands(subProgram, commands, done) {
	commands.forEach((cmd) => {
		var pluginCommand = subProgram
			.command(cmd.name)
			.description(cmd.description);

		// register options
		(cmd.options || []).forEach((opt) => {
			pluginCommand.option(opt.flags, opt.description, null, opt.default);
		});

		// register action
		pluginCommand.action((command, cmdArgs) => {
			try {
				cmd.action(cmdArgs || {}, done);
			} catch (err) {
				console.error('\x1b[31m Plugin error [' + cmd.plugin + '] \x1b[0m');
				winston.error(err);
				process.exit(1);
			}
		});
	});
}


function registerProgramUtilities(subProgram, commands, done) {
	subProgram.on('command:*', () => {
		console.error('\n\x1b[31mInvalid command: %s\x1b[0m', subProgram.args[0]);
		console.log('\nAvailable commands are:');
		printCommandList(commands);
		process.exit(1);
	});

	subProgram.command('ls').alias('list')
		.description('Lists all available commands')
		.action(() => {
			printCommandList(commands);
			done();
		});
}

function start(command, args, program) {
	var subProgram = new program.Command('cmd');

	async.waterfall([
		// Init database
		db.init,
		// load NodeBB plugins
		plugins.getActive,
		// parse plugins commands
		parseCommands,
		// Register commands
		(commands, done) => {
			registerProgramUtilities(subProgram, commands, done);
			registerPluginCommands(subProgram, commands, done);
			command = command.replace(/^nodebb-plugin/, '');
			var argv = process.argv.slice(0, 2).concat(command, args);
			subProgram.parse(argv);
		},
	], (err) => {
		if (err) {
			winston.error(err);
			process.exit(1);
		}
		process.exit(0);
	});
}

module.exports.start = start;
