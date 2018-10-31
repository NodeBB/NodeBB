'use strict';

var fs = require('fs');
var path = require('path');
var nconf = require('nconf');
var program = require('commander');

var dirname = require('../cli/paths').baseDir;
var file = require('../file');
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
var configExists = file.existsSync(configFile) || (nconf.get('url') && nconf.get('secret') && nconf.get('database'));

prestart.loadConfig(configFile);