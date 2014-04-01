'use strict';

var async = require('async'),
	fs = require('fs'),
	url = require('url'),
	path = require('path'),
	prompt = require('prompt'),
	winston = require('winston'),
	nconf = require('nconf'),
	utils = require('../public/src/utils.js'),

	install = {
		questions: [{
			name: 'base_url',
			description: 'URL of this installation',
			'default': nconf.get('base_url') || 'http://localhost',
			pattern: /^http(?:s)?:\/\//,
			message: 'Base URL must begin with \'http://\' or \'https://\'',
		}, {
			name: 'port',
			description: 'Port number of your NodeBB',
			'default': nconf.get('port') || 4567,
			pattern: /[0-9]{1,4}|[1-5][0-9]{4}|6[0-4][0-9]{3}|65[0-4][0-9]{2}|655[0-2][0-9]|6553[0-5]/,
			message: 'Please enter a value betweeen 1 and 65535'
		}, {
			name: 'use_port',
			description: 'Use a port number to access NodeBB?',
			'default': (nconf.get('use_port') !== undefined ? (nconf.get('use_port') ? 'y' : 'n') : 'y'),
			pattern: /y[es]*|n[o]?/,
			message: 'Please enter \'yes\' or \'no\''
		}, {
			name: 'secret',
			description: 'Please enter a NodeBB secret',
			'default': nconf.get('secret') || utils.generateUUID()
		}, {
			name: 'bind_address',
			description: 'IP or Hostname to bind to',
			'default': nconf.get('bind_address') || '0.0.0.0'
		}, {
			name: 'database',
			description: 'Which database to use',
			'default': nconf.get('database') || 'redis'
		}],
		redisQuestions : [{
			name: 'redis:host',
			description: 'Host IP or address of your Redis instance',
			'default': nconf.get('redis:host') || '127.0.0.1'
		}, {
			name: 'redis:port',
			description: 'Host port of your Redis instance',
			'default': nconf.get('redis:port') || 6379
		}, {
			name: 'redis:password',
			description: 'Password of your Redis database'
		}, {
			name: "redis:database",
			description: "Which database to use (0..n)",
			'default': nconf.get('redis:database') || 0
		}],
		mongoQuestions : [{
			name: 'mongo:host',
			description: 'Host IP or address of your MongoDB instance',
			'default': nconf.get('mongo:host') || '127.0.0.1'
		}, {
			name: 'mongo:port',
			description: 'Host port of your MongoDB instance',
			'default': nconf.get('mongo:port') || 27017
		}, {
			name: 'mongo:username',
			description: 'MongoDB username'
		}, {
			name: 'mongo:password',
			description: 'Password of your MongoDB database'
		}, {
			name: "mongo:database",
			description: "Which database to use (0..n)",
			'default': nconf.get('mongo:database') || 0
		}],

		setup: function (callback) {
			async.series([
				function(next) {
					// Check if the `--setup` flag contained values we can work with
					var	setupVal;
					try {
						setupVal = JSON.parse(nconf.get('setup'));
					} catch (e) {
						setupVal = undefined;
					}

					if (setupVal && setupVal instanceof Object) {
						if (setupVal['admin:username'] && setupVal['admin:password'] && setupVal['admin:password:confirm'] && setupVal['admin:email']) {
							install.values = setupVal;
							next();
						} else {
							winston.error('Required values are missing for automated setup:');
							if (!setupVal['admin:username']) winston.error('  admin:username');
							if (!setupVal['admin:password']) winston.error('  admin:password');
							if (!setupVal['admin:password:confirm']) winston.error('  admin:password:confirm');
							if (!setupVal['admin:email']) winston.error('  admin:email');
							process.exit();
						}
					} else {
						next();
					}
				},
				function (next) {
					var	success = function (err, config) {
						if (!config) {
							return next(new Error('aborted'));
						}

						var dbQuestionsSuccess = function (err, databaseConfig) {
							if (!databaseConfig) {
								return next(new Error('aborted'));
							}

							// Translate redis properties into redis object
							if(config.database === 'redis') {
								config.redis = {
									host: databaseConfig['redis:host'],
									port: databaseConfig['redis:port'],
									password: databaseConfig['redis:password'],
									database: databaseConfig['redis:database']
								};

								if (config.redis.host.slice(0, 1) === '/') {
									delete config.redis.port;
								}
							} else if (config.database === 'mongo') {
								config.mongo = {
									host: databaseConfig['mongo:host'],
									port: databaseConfig['mongo:port'],
									username: databaseConfig['mongo:username'],
									password: databaseConfig['mongo:password'],
									database: databaseConfig['mongo:database']
								};
							} else {
								return next(new Error('unknown database : ' + config.database));
							}

							var allQuestions = install.redisQuestions.concat(install.mongoQuestions);
							for(var x=0;x<allQuestions.length;x++) {
								delete config[allQuestions[x].name];
							}

							config.bcrypt_rounds = 12;
							config.upload_path = '/public/uploads';
							config.use_port = config.use_port.slice(0, 1) === 'y';

							var urlObject = url.parse(config.base_url),
								relative_path = (urlObject.pathname && urlObject.pathname.length > 1) ? urlObject.pathname : '',
								host = urlObject.host,
								protocol = urlObject.protocol,
								server_conf = config;

							server_conf.base_url = protocol + '//' + host;
							server_conf.relative_path = relative_path;

							install.save(server_conf, function(err) {
								if (err) {
									return next(err);
								}
								require('./database').init(next);
							});
						};

						if(config.database === 'redis') {
							if (config['redis:host'] && config['redis:port']) {
								dbQuestionsSuccess(null, config);
							} else {
								prompt.get(install.redisQuestions, dbQuestionsSuccess);
							}
						} else if(config.database === 'mongo') {
							if (config['mongo:host'] && config['mongo:port']) {
								dbQuestionsSuccess(null, config);
							} else {
								prompt.get(install.mongoQuestions, dbQuestionsSuccess);
							}
						} else {
							return next(new Error('unknown database : ' + config.database));
						}
					};

					// prompt prepends "prompt: " to questions, let's clear that.
					prompt.start();
					prompt.message = '';
					prompt.delimiter = '';

					if (!install.values) {
						prompt.get(install.questions, success);
					} else {
						// Use provided values, fall back to defaults
						var	config = {},
							question, x, numQ, allQuestions = install.questions.concat(install.redisQuestions).concat(install.mongoQuestions);
						for(x=0,numQ=allQuestions.length;x<numQ;x++) {
							question = allQuestions[x];
							config[question.name] = install.values[question.name] || question['default'] || '';
						}
						success(null, config);
					}
				},
				function (next) {
					// Applying default database configs
					winston.info('Populating database with default configs, if not already set...');
					var meta = require('./meta'),
						defaults = [{
							field: 'title',
							value: 'NodeBB'
						}, {
							field: 'postDelay',
							value: 10
						}, {
							field: 'minimumPostLength',
							value: 8
						}, {
							field: 'allowGuestPosting',
							value: 0
						}, {
							field: 'allowGuestSearching',
							value: 0
						}, {
							field: 'allowTopicsThumbnail',
							value: 0
						}, {
							field: 'allowRegistration',
							value: 1
						}, {
							field: 'allowFileUploads',
							value: 0
						}, {
							field: 'maximumFileSize',
							value: 2048
						}, {
							field: 'minimumTitleLength',
							value: 3
						}, {
							field: 'maximumTitleLength',
							value: 255
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
							field: 'maximumSignatureLength',
							value: 255
						}, {
							field: 'maximumProfileImageSize',
							value: 256
						}, {
							field: 'chatMessagesToDisplay',
							value: 50
						}];

					async.each(defaults, function (configObj, next) {
						meta.configs.setOnEmpty(configObj.field, configObj.value, next);
					}, function (err) {
						meta.configs.init(next);
					});

					if (install.values) {
						if (install.values['social:twitter:key'] && install.values['social:twitter:secret']) {
							meta.configs.setOnEmpty('social:twitter:key', install.values['social:twitter:key']);
							meta.configs.setOnEmpty('social:twitter:secret', install.values['social:twitter:secret']);
						}
						if (install.values['social:google:id'] && install.values['social:google:secret']) {
							meta.configs.setOnEmpty('social:google:id', install.values['social:google:id']);
							meta.configs.setOnEmpty('social:google:secret', install.values['social:google:secret']);
						}
						if (install.values['social:facebook:key'] && install.values['social:facebook:secret']) {
							meta.configs.setOnEmpty('social:facebook:app_id', install.values['social:facebook:app_id']);
							meta.configs.setOnEmpty('social:facebook:secret', install.values['social:facebook:secret']);
						}
					}
				},
				function(next) {
					var	meta = require('./meta');
					winston.info('Enabling default theme: Lavender');

					meta.themes.set({
						type: 'local',
						id: 'nodebb-theme-lavender'
					}, next);
				},
				function (next) {
					// Check if an administrator needs to be created
					var Groups = require('./groups');
					Groups.get('administrators', {}, function (err, groupObj) {
						if (!err && groupObj && groupObj.memberCount > 0) {
							winston.info('Administrator found, skipping Admin setup');
							next();
						} else {
							install.createAdmin(next);
						}
					});
				},
				function (next) {
					// Categories
					var Categories = require('./categories');

					Categories.getAllCategories(0, function (err, data) {
						if (data.categories.length === 0) {
							winston.warn('No categories found, populating instance with default categories');

							fs.readFile(path.join(__dirname, '../', 'install/data/categories.json'), function (err, default_categories) {
								default_categories = JSON.parse(default_categories);

								async.eachSeries(default_categories, function (category, next) {
									Categories.create(category, next);
								}, function (err) {
									if (!err) {
										next();
									} else {
										winston.error('Could not set up categories');
									}
								});
							});
						} else {
							winston.info('Categories OK. Found ' + data.categories.length + ' categories.');
							next();
						}
					});
				},
				function (next) {
					// Default plugins
					var Plugins = require('./plugins'),
						db = require('./database.js');

					winston.info('Enabling default plugins');

					var defaultEnabled = [
						'nodebb-plugin-markdown', 'nodebb-plugin-mentions', 'nodebb-widget-essentials'
					];

					async.each(defaultEnabled, function (pluginId, next) {
						Plugins.isActive(pluginId, function (err, active) {
							if (!active) {
								Plugins.toggleActive(pluginId, function () {
									next();
								});
							} else {
								next();
							}
						});
					}, next);
				},
				function (next) {
					var db = require('./src/database').init(function(err) {
						if (!err) {
							db.setObjectField('widgets:global', 'footer', "[{\"widget\":\"html\",\"data\":{\"html\":\"<footer id=\\\"footer\\\" class=\\\"container footer\\\">\\r\\n\\t<div class=\\\"copyright\\\">\\r\\n\\t\\tCopyright © 2014 <a target=\\\"_blank\\\" href=\\\"https://www.nodebb.com\\\">NodeBB Forums</a> | <a target=\\\"_blank\\\" href=\\\"//github.com/designcreateplay/NodeBB/graphs/contributors\\\">Contributors</a>\\r\\n\\t</div>\\r\\n</footer>\",\"title\":\"\",\"container\":\"\"}}]", next);
						}
					});
				},
				function (next) {
					require('./upgrade').upgrade(next);
				}
			], function (err) {
				if (err) {
					winston.warn('NodeBB Setup Aborted. ' + err.message);
					process.exit();
				} else {
					callback();
				}
			});
		},
		createAdmin: function (callback) {
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
				}],
				passwordQuestions = [{
					name: 'password',
					description: 'Password',
					required: true,
					hidden: true,
					type: 'string'
				}, {
					name: 'password:confirm',
					description: 'Confirm Password',
					required: true,
					hidden: true,
					type: 'string'
				}],
				success = function(err, results) {
					if (!results) {
						return callback(new Error('aborted'));
					}

					if (results['password:confirm'] !== results.password) {
						winston.warn("Passwords did not match, please try again");
						return retryPassword(results);
					}

					nconf.set('bcrypt_rounds', 12);
					User.create({username: results.username, password: results.password, email: results.email}, function (err, uid) {
						if (err) {
							winston.warn(err.message + ' Please try again.');
							return callback(new Error('invalid-values'));
						}

						Groups.join('administrators', uid, callback);
					});
				},
				retryPassword = function (originalResults) {
					// Ask only the password questions
					prompt.get(passwordQuestions, function (err, results) {
						if (!results) {
							return callback(new Error('aborted'));
						}

						// Update the original data with newly collected password
						originalResults.password = results.password;
						originalResults['password:confirm'] = results['password:confirm'];

						// Send back to success to handle
						success(err, originalResults);
					});
				};

			// Add the password questions
			questions = questions.concat(passwordQuestions);

			if (!install.values) {
				prompt.get(questions, success);
			} else {
				var results = {
						username: install.values['admin:username'],
						email: install.values['admin:email'],
						password: install.values['admin:password'],
						'password:confirm': install.values['admin:password:confirm']
					};

				success(null, results);
			}
		},
		save: function (server_conf, callback) {
			var	serverConfigPath = path.join(__dirname, '../config.json');
			if (nconf.get('config')) {
				serverConfigPath = path.resolve(__dirname, '../', nconf.get('config'));
			}

			fs.writeFile(serverConfigPath, JSON.stringify(server_conf, null, 4), function (err) {
				if (err) {
					winston.error('Error saving server configuration! ' + err.message);
					return callback(err);
				}

				winston.info('Configuration Saved OK');

				nconf.file({
					file: path.join(__dirname, '..', 'config.json')
				});

				callback();
			});
		}
	};

module.exports = install;