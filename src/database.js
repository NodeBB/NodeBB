"use strict";

var nconf = require('nconf'),
	primaryDBConfig = nconf.get('database'),
	secondaryDBConfig = nconf.get('secondary_database'),
	secondaryModules = nconf.get('secondary_db_modules'),
	winston = require('winston'),
	async = require('async'),

	ALLOWED_MODULES = ['hash', 'list', 'sets', 'sorted'];

if(!primaryDBConfig) {
	winston.info('Database type not set! Run node app --setup');
	process.exit();
}

function setupSecondaryDB() {
	var secondaryDB = require('./database/' + secondaryDBConfig);

	secondaryModules = secondaryModules.split(/,\s*/);

	for (var module in secondaryModules) {
		if (secondaryModules.hasOwnProperty(module) && ALLOWED_MODULES.indexOf(module) !== -1) {
			primaryDB[module] = secondaryDB[module];
		}
	}

	var primaryDBinit = primaryDB.init,
		primaryDBclose = primaryDB.close;

	primaryDB.init = function(callback) {
		async.parallel([primaryDBinit, secondaryDB.init], callback);
	};

	primaryDB.close = function(callback) {
		async.parallel([primaryDBclose, secondaryDB.close], callback);
	};
}


var primaryDB = require('./database/' + primaryDBConfig);

if (secondaryDBConfig && secondaryModules) {
	setupSecondaryDB();
}

module.exports = primaryDB;