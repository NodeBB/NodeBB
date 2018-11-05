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
	if (commands.length) {
		commands.forEach((cmd) => {
			console.log(cmd.name.green + '\t\t\t' + cmd.description);
		});
	} else {
		console.warn('No commands available'.red);
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
				console.error(`Plugin error [${cmd.plugin}]`.red);
				winston.error(err);
				process.exit(1);
			}
		});
	});
}


function registerProgramUtilities(subProgram, commands, done) {
	subProgram.on('command:*', () => {
		console.error('\nInvalid command: %s'.red, subProgram.args[0]);
		if (commands.length) {
			console.log('\nAvailable commands are:');
			printCommandList(commands);
		}
		process.exit(1);
	});

	subProgram.on('--help', () => {
		printCommandList(commands);
		process.exit(1);
	});

	subProgram.command('ls')
		.alias('list')
		.description('Lists all available commands')
		.action(() => {
			printCommandList(commands);
			done();
		});
}

function bootstrap(callback) {
	async.waterfall([
		// Init database
		db.init,
		// load NodeBB plugins
		plugins.getActive,
		// parse plugins commands
		parseCommands,
		(commands, done) => {
			callback(commands, done);
		},
	], (err) => {
		if (err) {
			winston.error(err);
			process.exit(1);
		}
		process.exit(0);
	});
}

function start(command, args, program) {
	var subProgram = new program.Command('cmd');

	bootstrap((commands, done) => {
		registerProgramUtilities(subProgram, commands, done);
		registerPluginCommands(subProgram, commands, done);
		command = command.replace(/^nodebb-plugin/, '');
		var argv = process.argv.slice(0, 2).concat(command, args);
		subProgram.parse(argv);
	});
}

module.exports.start = start;
