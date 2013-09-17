var async = require('async'),
	utils = require('../public/src/utils.js'),
	fs = require('fs'),
	url = require('url'),
	path = require('path'),
	prompt = require('prompt'),
	winston = require('winston'),
	reds = require('reds'),

	install = {
		questions: [{
			name: 'base_url',
			description: 'URL of this installation',
			'default': 'http://localhost',
			pattern: /^http(?:s)?:\/\//,
			message: 'Base URL must begin with \'http://\' or \'https://\'',
		}, {
			name: 'port',
			description: 'Port number of your NodeBB',
			'default': 4567
		}, {
			name: 'use_port',
			description: 'Use a port number to access NodeBB?',
			'default': 'y',
			pattern: /y[es]*|n[o]?/,
			message: 'Please enter \'yes\' or \'no\'',
		}, {
			name: 'secret',
			description: 'Please enter a NodeBB secret',
			'default': utils.generateUUID()
		}, {
			name: 'redis:host',
			description: 'Host IP or address of your Redis instance',
			'default': '127.0.0.1'
		}, {
			name: 'redis:port',
			description: 'Host port of your Redis instance',
			'default': 6379
		}, {
			name: 'redis:password',
			description: 'Password of your Redis database'
		}],
		setup: function(callback) {
			async.series([
				function(next) {
					// prompt prepends "prompt: " to questions, let's clear that.
					prompt.start();
					prompt.message = '';
					prompt.delimiter = '';

					prompt.get(install.questions, function(err, config) {
						if (!config) return next(new Error('aborted'));

						// Translate redis properties into redis object
						config.redis = {
							host: config['redis:host'],
							port: config['redis:port'],
							password: config['redis:password']
						};
						delete config['redis:host'];
						delete config['redis:port'];
						delete config['redis:password'];

						// Add hardcoded values
						config['bcrypt_rounds'] = 12,
						config['upload_path'] = '/public/uploads';
						config['use_port'] = (config['use_port'].slice(0, 1) === 'y') ? true : false;

						var urlObject = url.parse(config.base_url),
							relative_path = (urlObject.pathname && urlObject.pathname.length > 1) ? urlObject.pathname : '',
							host = urlObject.host,
							protocol = urlObject.protocol,
							server_conf = config,
							client_conf = {
								socket: {
									address: protocol + '//' + host + (config.use_port ? ':' + config.port : '')
								},
								api_url: protocol + '//' + host + (config.use_port ? ':' + config.port : '') + relative_path + '/api/',
								relative_path: relative_path
							};

						server_conf.base_url = protocol + '//' + host;
						server_conf.relative_path = relative_path;

						install.save(server_conf, client_conf, next);
					});
				},
				function(next) {
					// Applying default database configs
					winston.info('Populating database with default configs, if not already set...')
					var meta = require('./meta'),
						defaults = [{
							field: 'postDelay',
							value: 10000
						}, {
							field: 'minimumPostLength',
							value: 8
						}, {
							field: 'minimumTitleLength',
							value: 3
						}, {
							field: 'minimumUsernameLength',
							value: 2
						}, {
							field: 'maximumUsernameLength',
							value: 16
						}, {
							field: 'minimumPasswordLength',
							value: 6
						}, {
							field: 'imgurClientID',
							value: ''
						}];

					async.each(defaults, function(configObj, next) {
						meta.configs.setOnEmpty(configObj.field, configObj.value, next);
					}, function(err) {
						meta.configs.init(next);
					});
				},
				function(next) {
					// Check if an administrator needs to be created
					var Groups = require('./groups');

					Groups.getGidFromName('Administrators', function(err, gid) {
						if (err) return next(err.message);

						if (gid) {
							Groups.get(gid, {}, function(err, groupObj) {
								if (groupObj.count > 0) {
									winston.info('Administrator found, skipping Admin setup');
									next();
								} else install.createAdmin(next);
							});
						} else install.createAdmin(next);
					});
				},
				function(next) {
					// Categories
					var Categories = require('./categories'),
						admin = {
							categories: require('./admin/categories')
						};

					categories.getAllCategories(function(data) {
						if (data.categories.length === 0) {
							winston.warn('No categories found, populating instance with default categories')

							fs.readFile(path.join(__dirname, '../', 'install/data/categories.json'), function(err, default_categories) {
								default_categories = JSON.parse(default_categories);

								async.eachSeries(default_categories, function(category, next) {
									admin.categories.create(category, next);
								}, function(err) {
									if (!err) next();
									else winston.error('Could not set up categories');
								});
							});
						} else {
							winston.info('Categories OK. Found ' + data.categories.length + ' categories.');
							next();
						}
					});
				},
				function(next) {
					// Default plugins
					var Plugins = require('./plugins');

					winston.info('Enabling default plugins');

					var defaultEnabled = [
						'nodebb-plugin-markdown', 'nodebb-plugin-mentions'
					];

					async.each(defaultEnabled, function(pluginId, next) {
						Plugins.isActive(pluginId, function(err, active) {
							if (!active) {
								Plugins.toggleActive(pluginId, function() {
									next();
								});
							} else next();
						})
					}, next);
				}
			], function(err) {
				if (err) {
					winston.warn('NodeBB Setup Aborted.');
					process.exit();
				} else callback();
			});
		},
		createAdmin: function(callback) {
			var User = require('./user'),
				Groups = require('./groups');

			winston.warn('No administrators have been detected, running initial user setup');
			var questions = [{
				name: 'username',
				description: 'Administrator username',
				required: true,
				type: 'string'
			}, {
				name: 'email',
				description: 'Administrator email address',
				pattern: /.+@.+/,
				required: true
			}, {
				name: 'password',
				description: 'Password',
				required: true,
				hidden: true,
				type: 'string'
			}],
				getAdminInfo = function(callback) {
					prompt.get(questions, function(err, results) {
						if (!results) return callback(new Error('aborted'));

						nconf.set('bcrypt_rounds', 12);
						User.create(results.username, results.password, results.email, function(err, uid) {
							if (err) {
								winston.warn(err.message + ' Please try again.');
								return getAdminInfo();
							}

							Groups.getGidFromName('Administrators', function(err, gid) {
								if (gid) Groups.join(gid, uid, callback);
								else {
									Groups.create('Administrators', 'Forum Administrators', function(err, groupObj) {
										Groups.join(groupObj.gid, uid, callback);
									});
								}
							});
						});
					});
				};

			getAdminInfo(callback);
		},
		save: function(server_conf, client_conf, callback) {
			// Server Config
			async.parallel([
				function(next) {
					fs.writeFile(path.join(__dirname, '../', 'config.json'), JSON.stringify(server_conf, null, 4), function(err) {
						next(err);
					});
				},
				function(next) {
					fs.writeFile(path.join(__dirname, '../', 'public', 'config.json'), JSON.stringify(client_conf, null, 4), function(err) {
						next(err);
					});
				}
			], function(err) {
				winston.info('Configuration Saved OK');

				nconf.file({
					file: path.join(__dirname, '..', 'config.json')
				});

				var RDB = require('./redis');
				reds.createClient = function() {
					return reds.client || (reds.client = RDB);
				}

				callback(err);
			});
		}
	};

module.exports = install;