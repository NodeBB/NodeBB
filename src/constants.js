'use strict';

const path = require('path');

const baseDir = path.join(__dirname, '../');
const loader = path.join(baseDir, 'loader.js');
const app = path.join(baseDir, 'app.js');
const pidfile = path.join(baseDir, 'pidfile');
const config = path.join(baseDir, 'config.json');
const currentPackage = path.join(baseDir, 'package.json');
const installPackage = path.join(baseDir, 'install/package.json');
const nodeModules = path.join(baseDir, 'node_modules');

exports.paths = {
	baseDir,
	loader,
	app,
	pidfile,
	config,
	currentPackage,
	installPackage,
	nodeModules,
};

exports.pluginNamePattern = /^(@[\w-]+\/)?nodebb-(theme|plugin|widget|rewards)-[\w-]+$/;
exports.themeNamePattern = /^(@[\w-]+\/)?nodebb-theme-[\w-]+$/;
