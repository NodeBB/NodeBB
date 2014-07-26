"use strict";

var nconf = require('nconf'),
	primaryDBName = nconf.get('database'),
	secondaryDBName = nconf.get('secondary_database'),
	secondaryModules = nconf.get('secondary_db_modules'),
	winston = require('winston'),
	async = require('async'),

	ALLOWED_MODULES = ['hash', 'list', 'sets', 'sorted'];

if(!primaryDBName) {
	winston.info('Database type not set! Run ./nodebb setup');
	process.exit();
}

function setupSecondaryDB() {
	var secondaryDB = require('./database/' + secondaryDBName);

	secondaryModules = secondaryModules.split(/,\s*/);

	for (var module in secondaryModules) {
		if (secondaryModules.hasOwnProperty(module) && ALLOWED_MODULES.indexOf(module) !== -1) {
			primaryDB[module] = secondaryDB[module];
		}
	}

	var primaryDBinit = primaryDB.init,
		primaryDBclose = primaryDB.close,
		primaryDBhelpers = primaryDB.helpers;

	primaryDB.init = function(callback) {
		async.parallel([primaryDBinit, secondaryDB.init], callback);
	};

	primaryDB.close = function(callback) {
		async.parallel([primaryDBclose, secondaryDB.close], callback);
	};

	primaryDB.helpers = {};
	primaryDB.helpers[primaryDBName] = primaryDBhelpers[primaryDBName];
	primaryDB.helpers[secondaryDBName] = secondaryDB.helpers[secondaryDBName];
}


var primaryDB = require('./database/' + primaryDBName);

if (secondaryDBName && secondaryModules) {
	setupSecondaryDB();
}

module.exports = primaryDB;