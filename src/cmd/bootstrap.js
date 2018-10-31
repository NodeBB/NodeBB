'use strict';

var path = require('path');
var nconf = require('nconf');
var program = require('commander');

var dirname = require('../cli/paths').baseDir;
var prestart = require('../prestart');

nconf.argv().env({
	separator: '__',
});

var env = program.dev ? 'development' : (process.env.NODE_ENV || 'production');
process.env.NODE_ENV = env;
global.env = env;

prestart.setupWinston();

// Alternate configuration file support
var	configFile = path.resolve(dirname, 'config.json');

prestart.loadConfig(configFile);
