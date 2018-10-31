'use strict';

var async = require('async');

// remove the cmd segment from argvs
process.argv.splice(2, 1);

if (!process.argv[2]) {
	console.error('No command specified! \nSee --help for a list of available commands.');
	process.exit(1);
}

process.argv[2] = process.argv[2].replace('nodebb-plugin-', '');

require('./bootstrap');

var db = require('../database');
var cmdInit = require('./init');

async.waterfall([

	// Init database
	db.init,

	// Load installed plugins commands
	cmdInit.loadPluginCommands,

	// Register plugins commands
	cmdInit.registerCommands,

], function () {
	process.exit();
});
