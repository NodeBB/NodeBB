'use strict';

var path = require('path');

var baseDir = path.join(__dirname, '../../');
var loader = path.join(baseDir, 'loader.js');
var app = path.join(baseDir, 'app.js');
var pidfile = path.join(baseDir, 'pidfile');
var config = path.join(baseDir, 'config.json');

module.exports = {
	baseDir: baseDir,
	loader: loader,
	app: app,
	pidfile: pidfile,
	config: config,
};
