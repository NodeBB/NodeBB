'use strict';

var async = require('async');
var db = require('../database');
var cmdInit = require('./init');

function start(command, args, program) {
	var subProgram = new program.Command('cmd');

	subProgram.on('command:*', function () {
		console.error('Invalid command: %s\nSee --help for a list of available commands.', program.args.join(' '));
		process.exit(1);
	});

	// remove the cmd segment from argvs
	var argv = process.argv.slice(0, 2).concat(command, args);
	command = command.replace(/^nodebb-plugin/, '');

	async.waterfall(
		[
			// Init database
			db.init,

			// Load installed plugins commands
			cmdInit.loadPluginCommands,

			// Register plugins commands
			function registerCommands(commands, done) {
				subProgram
					.command('list')
					.description('Lists all available commands')
					.action(function () {
						commands.forEach(function (cmd) {
							console.log(cmd.name);
							done();
						});
					});

				commands.forEach(function (cmd) {
					var pluginCommand = subProgram
						.command(cmd.name)
						.description(cmd.description);

					// register options
					cmd.options.forEach(function (opt) {
						pluginCommand.option(opt.flags, opt.description, null, opt.default);
					});

					// register action
					pluginCommand.action(function (command, args) {
						cmd.action(args || {}, done);
					});
				});

				subProgram.parse(argv);
			},
		],
		function () {
			process.exit();
		}
	);
}

module.exports.start = start;
