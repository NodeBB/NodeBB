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

// Read config.js to grab redis info
var fs = require('fs'),
	nconf = require('nconf'),
	pkg = require('./package.json'),
	url = require('url');

// Runtime environment
global.env = process.env.NODE_ENV || 'production',

// Configuration setup
nconf.argv().file({ file: __dirname + '/config.json'});

// Log GNU copyright info along with server info
console.log('Info: NodeBB v' + pkg.version + ' Copyright (C) 2013 DesignCreatePlay Inc.');
console.log('Info: This program comes with ABSOLUTELY NO WARRANTY.');
console.log('Info: This is free software, and you are welcome to redistribute it under certain conditions.');
console.log('Info: ===');

if(nconf.get('upgrade')) {
	require('./src/upgrade').upgrade();
} else if (!nconf.get('setup') && nconf.get('base_url')) {
	nconf.set('url', nconf.get('base_url') + (nconf.get('use_port') ? ':' + nconf.get('port') : '') + nconf.get('relative_path') + '/');
	nconf.set('upload_url', nconf.get('url') + 'uploads/');
	global.nconf = nconf;

	console.log('Info: Initializing NodeBB v' + pkg.version + ', on port ' + nconf.get('port') + ', using Redis store at ' + nconf.get('redis:host') + ':' + nconf.get('redis:port') + '.');
	console.log('Info: Base Configuration OK.');

	// TODO: Replace this with nconf-redis
	var	meta = require('./src/meta.js');
	global.config = {};
	meta.config.get(function(config) {
		for(c in config) {
			if (config.hasOwnProperty(c)) {
				global.config[c] = config[c];
			}
		}

		var categories = require('./src/categories.js'),
			RDB = require('./src/redis.js'),
			templates = require('./public/src/templates.js'),
			webserver = require('./src/webserver.js'),
			websockets = require('./src/websockets.js'),
			plugins = require('./src/plugins'),
			admin = {
				'categories': require('./src/admin/categories.js')
			};

		DEVELOPMENT = true;

		global.configuration = {};
		global.templates = {};

		(function(config) {
			config['ROOT_DIRECTORY'] = __dirname;

			templates.init([
				'header', 'footer', 'logout', 'outgoing', 'admin/header', 'admin/footer', 'admin/index',
				'emails/reset', 'emails/reset_plaintext', 'emails/email_confirm', 'emails/email_confirm_plaintext',
				'emails/header', 'emails/footer', 'install/header', 'install/footer', 'install/redis',

				'noscript/header', 'noscript/home', 'noscript/category', 'noscript/topic'
			]);

			templates.ready(webserver.init);

			//setup scripts to be moved outside of the app in future.
			function setup_categories() {
				console.log('Info: Checking categories...');
				categories.getAllCategories(function(data) {
					if (data.categories.length === 0) {
						console.log('Info: Setting up default categories...');

						fs.readFile(config.ROOT_DIRECTORY + '/install/data/categories.json', function(err, default_categories) {
							default_categories = JSON.parse(default_categories);

							for (var category in default_categories) {
								admin.categories.create(default_categories[category]);
							}
						});

						
						console.log('Info: Hardcoding uid 1 as an admin');
						var user = require('./src/user.js');
						user.makeAdministrator(1);
					} else {
						console.log('Info: Categories OK. Found ' + data.categories.length + ' categories.');
					}
				});
			}
			setup_categories();
		}(global.configuration));
	});
} else {
	// New install, ask setup questions
	if (nconf.get('setup')) console.log('Info: NodeBB Setup Triggered via Command Line');
	else console.log('Info: Configuration not found, starting NodeBB setup');

	var	install = require('./src/install');

	process.stdout.write(
		"\nWelcome to NodeBB!\nThis looks like a new installation, so you'll have to answer a " +
		"few questions about your environment before we can proceed.\n\n" +
		"Press enter to accept the default setting (shown in brackets).\n\n\n"
	);

	install.setup(function(err) {
		if (err) {
			console.log('Error: There was a problem completing NodeBB setup: ', err.message);
		} else {
			if (!nconf.get('setup')) {
				process.stdout.write(
					"Please start NodeBB again and register a new user. This user will automatically become an administrator.\n\n"
				);
			}
		}

		process.exit();
	});
}