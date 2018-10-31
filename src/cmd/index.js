'use strict';

var async = require('async');

require('./bootstrap');

var db = require('../database');
var cmdInit = require('./init');

// remove the cmd segment from argvs
process.argv.splice(2, 1);
process.argv[2] = process.argv[2].replace('nodebb-plugin-', '');

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
