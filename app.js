// Read config.js to grab redis info
var fs = require('fs'),
	path = require('path'),
	utils = require('./public/src/utils.js');

console.log('Info: Checking for valid base configuration file');
fs.readFile(path.join(__dirname, 'config.json'), function(err, data) {
	if (!err) {
		global.config = JSON.parse(data);
		global.config.url = global.config.base_url + (global.config.use_port ? ':' + global.config.port : '') + '/';
		global.config.upload_url = global.config.url + 'uploads/';
		console.log('Info: Base Configuration OK.');

		var	meta = require('./src/meta.js');
		meta.config.get(function(config) {
			for(c in config) {
				if (config.hasOwnProperty(c)) {
					global.config[c] = config[c];
				}
			}

			var categories = require('./src/categories.js'),
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
					'emails/header', 'emails/footer', 'install/header', 'install/footer', 'install/redis'
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
									admin.categories.create(default_categories[category]);
								}
							});

						} else {
							console.log('Info: Good.');
						}
					});
				}
				setup_categories();
			}(global.configuration));
		});
	} else {
		// New install, ask setup questions
		console.log('Info: Configuration not found, starting NodeBB setup');
		var	ask = function(question, callback) {
				process.stdin.resume();
				process.stdout.write(question + ': ');

				process.stdin.once('data', function(data) {
					callback(data.toString().trim());
				});
			}

		process.stdout.write(
			"\nWelcome to NodeBB!\nThis looks like a new installation, so you'll have to answer a " +
			"few questions about your environment before we can proceed with the setup.\n\n" +
			"Press enter to accept the default setting (shown in brackets).\n\n\n" +
			"What is...\n\n"
		);

		ask('... the publically accessible URL of this installation? (http://localhost)', function(base_url) {
			ask('... the port number of your install? (4567)', function(port) {
				ask('Will you be using a port number to access NodeBB? (y)', function(use_port) {
					ask('... the host IP or address of your Redis instance? (127.0.0.1)', function(redis_host) {
						ask('... the host port of your Redis instance? (6379)', function(redis_port) {
							ask('... your NodeBB secret? (keyboard mash for a bit here)', function(secret) {
								if (!base_url) base_url = 'http://localhost';
								if (!port) port = 4567;
								if (!use_port) use_port = true; else use_port = (use_port === 'y' ? true : false);
								if (!redis_host) redis_host = '127.0.0.1';
								if (!redis_port) redis_port = 6379;
								if (!secret) secret = utils.generateUUID();

								var	fs = require('fs'),
									path = require('path'),
									config = {
										secret: secret,
										base_url: base_url,
										port: port,
										use_port: use_port,
										upload_path: '/public/uploads/',
										redis: {
											host: redis_host,
											port: redis_port
										}
									}

								fs.writeFile(path.join(__dirname, 'config.json'), JSON.stringify(config, null, 4), function(err) {
									if (err) throw err;
									else {
										process.stdout.write(
											"\n\nConfiguration Saved OK\n\nPlease start NodeBB again and navigate to " +
											base_url + (use_port ? ':' + port : '') + "/install to continue setup.\n\n"
										);
										process.exit();
									}
								});
							});
						});
					});
				});
			});
		});
	}
});