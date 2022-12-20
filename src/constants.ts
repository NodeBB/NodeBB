'use strict';

import path from 'path';

const baseDir = path.join(__dirname, '../');
const loader = path.join(baseDir, '../loader.js');
const app = path.join(baseDir, 'app.js');
const pidfile = path.join(baseDir, 'pidfile');
const config = path.join(baseDir, '../config.json');
const currentPackage = path.join(baseDir, '../package.json');
const installPackage = path.join(baseDir, 'install/package.json');
const nodeModules = path.join(baseDir, '../node_modules');

export const paths = {
	baseDir,
	loader,
	app,
	pidfile,
	config,
	currentPackage,
	installPackage,
	nodeModules,
};

export const pluginNamePattern = /^(@[\w-]+\/)?nodebb-(theme|plugin|widget|rewards)-[\w-]+$/;
export const themeNamePattern = /^(@[\w-]+\/)?nodebb-theme-[\w-]+$/;
