'use strict';

var path = require('path');
var async = require('async');
var program = require('commander');
var plugins = require('../plugins');

// error on unknown commands
program.on('command:*', function () {
	console.error('Invalid command: %s\nSee --help for a list of available commands.', program.args.join(' '));
	process.exit(1);
});

function loadPluginCommands(next) {
	async.waterfall([

		// load NodeBB plugins
		plugins.data.getActive,

		// parse plugins commands
		function (pluginList) {
			var commands = [];

			pluginList.forEach(function (pluginData) {
				var pluginCommands = pluginData.commands || [];

				pluginCommands.forEach(function (cmdData) {
					var pluginName = pluginData.id;
					var libraryFile = cmdData.library ? cmdData.library : pluginData.library;
					var cmdName = pluginName.replace('nodebb-plugin-', '') + ':' + cmdData.cmd;
					var scriptFile = path.resolve(pluginData.path, libraryFile);

					commands.push({
						plugin: pluginName,
						name: cmdName,
						description: cmdData.description,
						options: cmdData.options,
						scriptFile: scriptFile,
						method: cmdData.method,
					});
				});
			});
			next(null, commands);
		},

	]);
}

function registerCommands(commands, callback) {
	commands.forEach((cmd) => {
		var regCommand = program.command(cmd.name);

		// register options
		cmd.options.forEach(function (opt) {
			regCommand.option(opt.flags, opt.description || null, null, opt.default || null);
		});

		regCommand
			.description(cmd.description)
			.action(function (env, options) {
				// resolve plugin command method
				var method = require(cmd.scriptFile)[cmd.method];

				method(options || {}, function () {
					callback();
				});
			});
	});
	program.parse(process.argv);
}

module.exports.loadPluginCommands = loadPluginCommands;
module.exports.registerCommands = registerCommands;
