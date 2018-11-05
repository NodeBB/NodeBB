'use strict';

var path = require('path');
var winston = require('winston');
var async = require('async');
var db = require('../database');
var plugins = require('../plugins/data');

function parseCommands(pluginList, callback) {
	var commands = [];

	pluginList.forEach(function (pluginData) {
		var pluginCommands = pluginData.commands || [];

		pluginCommands.forEach(function (cmdData) {
			var pluginName = pluginData.id;
			var cmdName = pluginName.replace('nodebb-plugin-', '') + ':' + cmdData.cmd;

			commands.push({
				plugin: pluginName,
				name: cmdName,
				description: cmdData.description,
				options: cmdData.options,
				action: function (cmdArgs, done) {
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


function start(command, args, program) {
	var subProgram = new program.Command('cmd');

	// remove the cmd segment from argvs
	command = command.replace(/^nodebb-plugin/, '');
	var argv = process.argv.slice(0, 2).concat(command, args);

	subProgram.on('command:*', function () {
		winston.error('Invalid command: %s\nUse cmd list for a list of available commands.', program.args[0]);
		process.exit(1);
	});

	async.waterfall([

		// Init database
		db.init,

		// load NodeBB plugins
		plugins.getActive,

		// parse plugins commands
		parseCommands,

		// Register plugins commands
		function (commands, done) {
			subProgram
				.command('list')
				.description('Lists all available commands')
				.action(function () {
					console.log('\n');
					if (commands.length) {
						commands.forEach(function (cmd) {
							console.log('\x1b[32m' + cmd.name + '\x1b[0m \t\t\t ' + cmd.description);
						});
					} else {
						console.log('\x1b[31m No commands available\x1b[0m');
					}
					console.log('\n');
					done();
				});

			commands.forEach(function (cmd) {
				var pluginCommand = subProgram
					.command(cmd.name)
					.description(cmd.description);

				// register options
				(cmd.options || []).forEach(function (opt) {
					pluginCommand.option(opt.flags, opt.description, null, opt.default);
				});

				// register action
				pluginCommand.action(function (command, cmdArgs) {
					try {
						cmd.action(cmdArgs || {}, done);
					} catch (err) {
						winston.error('Plugin error [' + cmd.plugin + ']');
						winston.error(err);
						process.exit(1);
					}
				});
			});

			subProgram.parse(argv);
		},
	], function (err) {
		if (err) {
			winston.error(err);
			process.exit(1);
		}
		process.exit(0);
	});
}

module.exports.start = start;
