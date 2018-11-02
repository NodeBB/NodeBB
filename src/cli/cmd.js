'use strict';

var path = require('path');
var async = require('async');
var db = require('../database');
var plugins = require('../plugins');

function parseCommands(pluginList, callback) {
	var commands = [];

	pluginList.forEach(function (pluginData) {
		var pluginCommands = pluginData.commands || [];

		pluginCommands.forEach(function (cmdData) {
			var pluginName = pluginData.id;
			var libraryFile = cmdData.library ? cmdData.library : pluginData.library;
			var cmdName = pluginName.replace('nodebb-plugin-', '') + ':' + cmdData.cmd;
			var scriptFile = path.resolve(pluginData.path, libraryFile);
			var action = require(scriptFile)[cmdData.method];

			commands.push({
				plugin: pluginName,
				name: cmdName,
				description: cmdData.description,
				options: cmdData.options,
				scriptFile: scriptFile,
				action: action,
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
		console.error('Invalid command: %s\nSee --help for a list of available commands.', program.args.join(' '));
		process.exit(1);
	});

	async.waterfall([
		// Init database
		db.init,

		// load NodeBB plugins
		plugins.data.getActive,

		// parse plugins commands
		parseCommands,

		// Register plugins commands
		function (commands, done) {
			subProgram
				.command('list')
				.description('Lists all available commands')
				.action(function () {
					commands.forEach(function (cmd) {
						console.log(cmd.name, cmd.description);
					});
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
				pluginCommand.action(function (command, args) {
					cmd.action(args || {}, done);
				});
			});

			subProgram.parse(argv);
		}], function () {
		process.exit();
	});
}

module.exports.start = start;
