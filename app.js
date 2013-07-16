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
	path = require('path'),
	utils = require('./public/src/utils.js'),
	url = require('url'),
	args = {};
global.ver = '0.0.2';

// Runtime environment
global.env = process.env.NODE_ENV || 'production',

// Parse any passed-in arguments
process.argv.slice(2).forEach(function(value) {
	if (value.slice(0, 2) === '--') {
		var arg = value.slice(2).split('=');
		args[arg[0]] = arg[1] || true;
	}
});

// Log GNU copyright info along with server info
console.log('Info: NodeBB v' + global.ver + ' Copyright (C) 2013 DesignCreatePlay Inc.');
console.log('Info: This program comes with ABSOLUTELY NO WARRANTY.');
console.log('Info: This is free software, and you are welcome to redistribute it under certain conditions.');
console.log('Info: ===');

fs.readFile(path.join(__dirname, 'config.json'), function(err, data) {
	if (!err && args.setup !== true) {
		global.config = JSON.parse(data);
		global.config.url = global.config.base_url + (global.config.use_port ? ':' + global.config.port : '') + '/';
		global.config.upload_url = global.config.url + 'uploads/';

		console.log('Info: Initializing NodeBB v' + global.ver + ', on port ' + global.config.port + ', using Redis store at ' + global.config.redis.host + ':' + global.config.redis.port + '.');
		console.log('Info: Base Configuration OK.');

		var	meta = require('./src/meta.js');
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
				admin = {
					'categories': require('./src/admin/categories.js')
				};

			DEVELOPMENT = true;

			global.configuration = {};
			global.templates = {};

			(function(config) {
				config['ROOT_DIRECTORY'] = __dirname;

				templates.init([
					'header', 'footer', 'logout', 'admin/header', 'admin/footer', 'admin/index',
					'emails/reset', 'emails/reset_plaintext', 'emails/email_confirm', 'emails/email_confirm_plaintext',
					'emails/header', 'emails/footer', 'install/header', 'install/footer', 'install/redis',

					'noscript/header', 'noscript/home', 'noscript/category', 'noscript/topic'
				]);

				templates.ready(function() {
					webserver.init();
				});

				//setup scripts to be moved outside of the app in future.
				function setup_categories() {
					console.log('Info: Checking categories...');
					categories.getAllCategories(function(data) {
						if (data.categories.length === 0) {
							console.log('Info: Setting up default categories...');

							fs.readFile(config.ROOT_DIRECTORY + '/install/data/categories.json', function(err, default_categories) {
								default_categories = JSON.parse(default_categories);

								for (var category in default_categories) {
									console.log(category);
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
		if (args.setup) console.log('Info: NodeBB Setup Triggered via Command Line');
		else console.log('Info: Configuration not found, starting NodeBB setup');

		var	ask = function(question, callback) {
				process.stdin.resume();
				process.stdout.write(question + ': ');

				process.stdin.once('data', function(data) {
					callback(data.toString().trim());
				});
			}

		process.stdout.write(
			"\nWelcome to NodeBB!\nThis looks like a new installation, so you'll have to answer a " +
			"few questions about your environment before we can proceed.\n\n" +
			"Press enter to accept the default setting (shown in brackets).\n\n\n" +
			"What is...\n\n"
		);

		ask('... the publically accessible URL of this installation? (http://localhost)', function(base_url) {
			ask('... the port number of your install? (4567)', function(port) {
				ask('Will you be using a port number to access NodeBB? (y)', function(use_port) {
					ask('... the host IP or address of your Redis instance? (127.0.0.1)', function(redis_host) {
						ask('... the host port of your Redis instance? (6379)', function(redis_port) {
							ask('... the password of your Redis database? (no password)', function(redis_password) {
								ask('... your NodeBB secret? (keyboard mash for a bit here)', function(secret) {
									ask('... the number of rounds to use for bcrypt.genSalt? (10)', function(bcrypt_rounds) {
										if (!base_url) base_url = 'http://localhost';
										if (!port) port = 4567;
										if (!use_port) use_port = true; else use_port = (use_port === 'y' ? true : false);
										if (!redis_host) redis_host = '127.0.0.1';
										if (!redis_port) redis_port = 6379;
										if (!secret) secret = utils.generateUUID();
										if (!bcrypt_rounds) bcrypt_rounds = 10;

										var urlObject = url.parse(base_url),
											relative_path = urlObject.pathname,
											host = urlObject.host,
											protocol = urlObject.protocol;
											
										if(relative_path.length === 1) {
											relative_path = '';
										}

										var	fs = require('fs'),
											path = require('path'),
											config = {
												secret: secret,
												base_url: base_url,
												relative_path: relative_path,
												port: port,
												use_port: use_port,
												upload_path: '/public/uploads/',
												bcrypt_rounds: bcrypt_rounds,
												redis: {
													host: redis_host,
													port: redis_port,
													password: redis_password
												}
											}

										// Server-side config
										fs.writeFile(path.join(__dirname, 'config.json'), JSON.stringify(config, null, 4), function(err) {
											if (err) throw err;
											else {
												process.stdout.write(
													"\n\nConfiguration Saved OK\n\n"
												);
												if (!args.setup) {
													process.stdout.write(
														"Please start NodeBB again and register a new user at " +
														base_url + (use_port ? ':' + port : '') + "/register. This user will automatically become an administrator.\n\n"
													);
												}
												process.stdout.write(
													"If at any time you'd like to run this setup again, run the app with the \"--setup\" flag\n\n"
												);
												process.exit();
											}
										});

										// Client-side config
										fs.writeFile(path.join(__dirname, 'public', 'config.json'), JSON.stringify({
											socket: {
												address: protocol + '//' + host,
												port: port
											},
											api_url: protocol + '//' + host + (use_port ? ':' + port : '') + relative_path + '/api/',
											relative_path: relative_path
										}, null, 4));
									});
								});
							});
						});
					});
				});
			});
		});
	}
});