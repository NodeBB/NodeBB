/*
	NodeBB - A better forum platform for the modern web
	https://github.com/NodeBB/NodeBB/
	Copyright (C) 2013-2021  NodeBB Inc.

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

import './require-main';

import nconf from 'nconf';

nconf.argv().env({
	separator: '__',
});

import winston from 'winston';
import path from 'path';
import file from './src/file';
import web from './install/web';
import * as Upgrade from './src/cli/upgrade';
import manage from './src/cli/manage';
import * as Reset from './src/cli/reset';
import * as Running from './src/cli/running';
import Setup from './src/cli/setup';

(process as any).env.NODE_ENV = (process as any).env.NODE_ENV || 'production';
(global as any).env = (process as any).env.NODE_ENV || 'production';

// Alternate configuration file support
const configFile = path.resolve(__dirname, nconf.any(['config', 'CONFIG']) || 'config.json');

const configExists = file.existsSync(configFile) || (nconf.get('url') && nconf.get('secret') && nconf.get('database'));

import * as prestart from './src/prestart';

prestart.loadConfig(configFile);
prestart.setupWinston();
prestart.versionCheck();
winston.verbose('* using configuration stored in: %s', configFile);

if (!(process as any).send) {
	// If run using `node app`, log GNU copyright info along with server info
	winston.info(`NodeBB v${nconf.get('version')} Copyright (C) 2013-${(new Date()).getFullYear()} NodeBB Inc.`);
	winston.info('This program comes with ABSOLUTELY NO WARRANTY.');
	winston.info('This is free software, and you are welcome to redistribute it under certain conditions.');
	winston.info('');
}

if (nconf.get('setup') || nconf.get('install')) {
	Setup.setup();
} else if (!configExists) {
	web.install(nconf.get('port'));
} else if (nconf.get('upgrade')) {
	Upgrade.upgrade(true);
} else if (nconf.get('reset')) {
	Reset.reset({
		theme: nconf.get('t'),
		plugin: nconf.get('p'),
		widgets: nconf.get('w'),
		settings: nconf.get('s'),
		all: nconf.get('a'),
	});
} else if (nconf.get('activate')) {
	manage.activate(nconf.get('activate'));
} else if (nconf.get('plugins') && typeof nconf.get('plugins') !== 'object') {
	manage.listPlugins();
} else if (nconf.get('build')) {
	manage.buildWrapper(nconf.get('build'));
} else if (nconf.get('events')) {
	manage.listEvents();
} else {
	require('./src/cli/manage')
	Running.start();
}
