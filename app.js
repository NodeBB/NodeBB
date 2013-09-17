/*
	NodeBB - A forum powered by node in development by designcreateplay
	Copyright (C) 2013  DesignCreatePlay Inc.

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

// Configuration setup
nconf = require('nconf');
nconf.argv().env();

var fs = require('fs'),
	winston = require('winston'),
	pkg = require('./package.json'),
	url = require('url');

// Runtime environment
global.env = process.env.NODE_ENV || 'production';



winston.remove(winston.transports.Console);
winston.add(winston.transports.Console, {
	colorize: true
});

winston.add(winston.transports.File, {
	filename: 'error.log',
	level: 'error'
});

// TODO: remove once https://github.com/flatiron/winston/issues/280 is fixed
winston.err = function(err) {
	winston.error(err.stack);
};

// Log GNU copyright info along with server info
winston.info('NodeBB v' + pkg.version + ' Copyright (C) 2013 DesignCreatePlay Inc.');
winston.info('This program comes with ABSOLUTELY NO WARRANTY.');
winston.info('This is free software, and you are welcome to redistribute it under certain conditions.');
winston.info('');

if (fs.existsSync(__dirname + '/config.json') && (!nconf.get('setup') && !nconf.get('upgrade'))) {
	// Load server-side config
	nconf.file({
		file: __dirname + '/config.json'
	});

	var meta = require('./src/meta.js');

	nconf.set('url', nconf.get('base_url') + (nconf.get('use_port') ? ':' + nconf.get('port') : '') + nconf.get('relative_path') + '/');
	nconf.set('upload_url', nconf.get('url') + 'uploads/');

	winston.info('Initializing NodeBB v' + pkg.version + ', on port ' + nconf.get('port') + ', using Redis store at ' + nconf.get('redis:host') + ':' + nconf.get('redis:port') + '.');
	if (process.env.NODE_ENV === 'development') winston.info('Base Configuration OK.');

	meta.configs.init(function() {
		// Initial setup for Redis & Reds
		var reds = require('reds');
		RDB = require('./src/redis.js');
		reds.createClient = function() {
			return reds.client || (reds.client = RDB);
		}

		var categories = require('./src/categories.js'),
			templates = require('./public/src/templates.js'),
			webserver = require('./src/webserver.js'),
			websockets = require('./src/websockets.js'),
			plugins = require('./src/plugins'), // Don't remove this - plugins initializes itself
			admin = {
				'categories': require('./src/admin/categories.js')
			};

		global.templates = {};
		templates.init([
			'header', 'footer', 'logout', 'outgoing', 'admin/header', 'admin/footer', 'admin/index',
			'emails/reset', 'emails/reset_plaintext', 'emails/email_confirm', 'emails/email_confirm_plaintext',
			'emails/header', 'emails/footer',

			'noscript/header', 'noscript/home', 'noscript/category', 'noscript/topic'
		]);

		templates.ready(webserver.init);
	});

} else if (nconf.get('upgrade')) {
	nconf.file({
		file: __dirname + '/config.json'
	});
	var meta = require('./src/meta.js');

	meta.configs.init(function() {
		require('./src/upgrade').upgrade();
	});
} else {
	// New install, ask setup questions
	if (nconf.get('setup')) winston.info('NodeBB Setup Triggered via Command Line');
	else winston.warn('Configuration not found, starting NodeBB setup');

	var install = require('./src/install'),
		meta = {
			config: {}
		};

	winston.info('Welcome to NodeBB!');
	winston.info('This looks like a new installation, so you\'ll have to answer a few questions about your environment before we can proceed.');
	winston.info('Press enter to accept the default setting (shown in brackets).');

	install.setup(function(err) {
		if (err) {
			winston.error('There was a problem completing NodeBB setup: ', err.message);
		} else {
			winston.info('NodeBB Setup Completed.');
		}

		process.exit();
	});
}