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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
require('./require-main');
const nconf_1 = __importDefault(require("nconf"));
nconf_1.default.argv().env({
    separator: '__',
});
const winston_1 = __importDefault(require("winston"));
const path_1 = __importDefault(require("path"));
const file = require('./src/file').default;
console.log('FILE', file);
process.env.NODE_ENV = process.env.NODE_ENV || 'production';
global.env = process.env.NODE_ENV || 'production';
// Alternate configuration file support
const configFile = path_1.default.resolve(__dirname, nconf_1.default.any(['config', 'CONFIG']) || 'config.json');
const configExists = file.existsSync(configFile) || (nconf_1.default.get('url') && nconf_1.default.get('secret') && nconf_1.default.get('database'));
const prestart = require('./src/prestart');
prestart.loadConfig(configFile);
prestart.setupWinston();
prestart.versionCheck();
winston_1.default.verbose('* using configuration stored in: %s', configFile);
if (!process.send) {
    // If run using `node app`, log GNU copyright info along with server info
    winston_1.default.info(`NodeBB v${nconf_1.default.get('version')} Copyright (C) 2013-${(new Date()).getFullYear()} NodeBB Inc.`);
    winston_1.default.info('This program comes with ABSOLUTELY NO WARRANTY.');
    winston_1.default.info('This is free software, and you are welcome to redistribute it under certain conditions.');
    winston_1.default.info('');
}
if (nconf_1.default.get('setup') || nconf_1.default.get('install')) {
    require('./src/cli/setup').setup();
}
else if (!configExists) {
    require('./install/web').default.install(nconf_1.default.get('port'));
}
else if (nconf_1.default.get('upgrade')) {
    require('./src/cli/upgrade').upgrade(true);
}
else if (nconf_1.default.get('reset')) {
    require('./src/cli/reset').reset({
        theme: nconf_1.default.get('t'),
        plugin: nconf_1.default.get('p'),
        widgets: nconf_1.default.get('w'),
        settings: nconf_1.default.get('s'),
        all: nconf_1.default.get('a'),
    });
}
else if (nconf_1.default.get('activate')) {
    require('./src/cli/manage').activate(nconf_1.default.get('activate'));
}
else if (nconf_1.default.get('plugins') && typeof nconf_1.default.get('plugins') !== 'object') {
    require('./src/cli/manage').listPlugins();
}
else if (nconf_1.default.get('build')) {
    require('./src/cli/manage').build(nconf_1.default.get('build'));
}
else if (nconf_1.default.get('events')) {
    require('./src/cli/manage').listEvents();
}
else {
    require('./src/start').default.start();
}
