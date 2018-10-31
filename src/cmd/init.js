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

module.exports = {

	loadPluginCommands: function (next) {
		async.waterfall([

			// load NodeBB plugins
			function (callback) {
				plugins.init(null, null, callback);
			},

			// parse plugins commands
			function () {
				var commands = [];
				var pluginList = Object.keys(plugins.pluginsData);

				pluginList.forEach(function (pluginName) {
					var pluginData = plugins.pluginsData[pluginName];
					var pluginCommands = pluginData.commands || [];

					if (pluginCommands.length === 0) {
						return;
					}

					pluginCommands.forEach(function (cmdData) {
						var cmdName = pluginName.replace('nodebb-plugin-', '') + ':' + cmdData.cmd;
						var scriptFile = path.resolve(pluginData.path, cmdData.library);

						commands.push({
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
	},

	registerCommands: function (commands, callback) {
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
	},

};
