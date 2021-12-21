/*
	NodeBB - A better forum platform for the modern web
	https://github.com/NodeBB/NodeBB/
	Copyright (C) 2013-2017  NodeBB Inc.

	This program is free software: you can redistribute it and/or modify
	it under the terms of the GNU General Public License as published by
	the Free Software Foundation, either version 3 of the License, or
	(at your option) any later version.

	This program is distributed in the hope that it will be useful,
	but WITHOUT ANY WARRANTY; without even the implied warranty of
	MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
	GNU General Public License for more details.

	You should have received a copy of the GNU General Public License
	along with this program.  If not, see <http://www.gnu.org/licenses/>.
*/

'use strict';

require('dotenv').config();

require('./require-main');

const nconf = require('nconf');

nconf.argv().env({
	separator: '__',
});

const winston = require('winston');
const path = require('path');

const file = require('./src/file');

process.env.NODE_ENV = process.env.NODE_ENV || 'production';
process.env.METEOR_DOMAIN = process.env.METEOR_DOMAIN || 'https://app.creaticode.com';
global.env = process.env.NODE_ENV || 'production';

// Alternate configuration file support
const configFile = path.resolve(__dirname, nconf.any(['config', 'CONFIG']) || 'config.json');

const configExists = file.existsSync(configFile) || (nconf.get('url') && nconf.get('secret') && nconf.get('database'));

const prestart = require('./src/prestart');

prestart.loadConfig(configFile);
prestart.setupWinston();
prestart.versionCheck();
winston.verbose('* using configuration stored in: %s', configFile);

if (!process.send) {
	// If run using `node app`, log GNU copyright info along with server info
	winston.info(`NodeBB v${nconf.get('version')} Copyright (C) 2013-${(new Date()).getFullYear()} NodeBB Inc.`);
	winston.info('This program comes with ABSOLUTELY NO WARRANTY.');
	winston.info('This is free software, and you are welcome to redistribute it under certain conditions.');
	winston.info('');
}

if (nconf.get('setup') || nconf.get('install')) {
	require('./src/cli/setup').setup();
} else if (!configExists) {
	require('./install/web').install(nconf.get('port'));
} else if (nconf.get('upgrade')) {
	require('./src/cli/upgrade').upgrade(true);
} else if (nconf.get('reset')) {
	require('./src/cli/reset').reset({
		theme: nconf.get('t'),
		plugin: nconf.get('p'),
		widgets: nconf.get('w'),
		settings: nconf.get('s'),
		all: nconf.get('a'),
	});
} else if (nconf.get('activate')) {
	require('./src/cli/manage').activate(nconf.get('activate'));
} else if (nconf.get('plugins')) {
	require('./src/cli/manage').listPlugins();
} else if (nconf.get('build')) {
	require('./src/cli/manage').build(nconf.get('build'));
} else if (nconf.get('events')) {
	require('./src/cli/manage').listEvents();
} else {
	require('./src/start').start();
}
