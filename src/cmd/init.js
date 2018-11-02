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
			next(null, commands);
		},

	]);
}

module.exports.loadPluginCommands = loadPluginCommands;
