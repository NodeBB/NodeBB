'use strict';

var async = require('async'),
	fs = require('fs'),
	url = require('url'),
	path = require('path'),
	prompt = require('prompt'),
	winston = require('winston'),
	nconf = require('nconf'),
	utils = require('../public/src/utils.js'),

	DATABASES = {
		"redis": {
			"dependencies": ["redis@~0.10.1", "connect-redis@~2.0.0"]
		},
		"mongo": {
			"dependencies": ["mongodb", "connect-mongo"]
		},
		"level": {
			"dependencies": ["levelup", "leveldown", "connect-leveldb"]
		}
	};


var install = {},
	questions = {};

questions.main = [
	{
		name: 'base_url',
		description: 'URL used to access this NodeBB',
		'default': nconf.get('base_url') + (nconf.get('use_port') ? ':' + nconf.get('port') : '') || 'http://localhost:4567',
		pattern: /^http(?:s)?:\/\//,
		message: 'Base URL must begin with \'http://\' or \'https://\'',
	},
	{
		name: 'port',
		description: 'Port number of your NodeBB',
		'default': nconf.get('port') || 4567,
		pattern: /[0-9]{1,4}|[1-5][0-9]{4}|6[0-4][0-9]{3}|65[0-4][0-9]{2}|655[0-2][0-9]|6553[0-5]/,
		message: 'Please enter a value betweeen 1 and 65535'
	},
	{
		name: 'secret',
		description: 'Please enter a NodeBB secret',
		'default': nconf.get('secret') || utils.generateUUID()
	},
	{
		name: 'bind_address',
		description: 'IP or Hostname to bind to',
		'default': nconf.get('bind_address') || '0.0.0.0'
	},
	{
		name: 'database',
		description: 'Which database to use',
		'default': nconf.get('database') || 'redis'
	}
];


function checkSetupFlag(next) {
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
			if (!setupVal['admin:username']) {
				winston.error('  admin:username');
			}
			if (!setupVal['admin:password']) {
				winston.error('  admin:password');
			}
			if (!setupVal['admin:password:confirm']) {
				winston.error('  admin:password:confirm');
			}
			if (!setupVal['admin:email']) {
				winston.error('  admin:email');
			}

			process.exit();
		}
	} else {
		next();
	}
}

function checkCIFlag(next) {
	var	ciVals;
	try {
		ciVals = JSON.parse(nconf.get('ci'));
	} catch (e) {
		ciVals = undefined;
	}

	if (ciVals && ciVals instanceof Object) {
		if (ciVals.hasOwnProperty('host') && ciVals.hasOwnProperty('port') && ciVals.hasOwnProperty('database')) {
			install.ciVals = ciVals;
			next();
		} else {
			winston.error('Required values are missing for automated CI integration:');
			if (!ciVals.hasOwnProperty('host')) {
				winston.error('  host');
			}
			if (!ciVals.hasOwnProperty('port')) {
				winston.error('  port');
			}
			if (!ciVals.hasOwnProperty('database')) {
				winston.error('  database');
			}

			process.exit();
		}
	} else {
		next();
	}
}

function setupConfig(next) {
	var configureDatabases = require('../install/databases');

	// prompt prepends "prompt: " to questions, let's clear that.
	prompt.start();
	prompt.message = '';
	prompt.delimiter = '';

	if (!install.values) {
		prompt.get(questions.main, function(err, config) {
			if (err) {
				process.stdout.write('\n\n');
				winston.warn('NodeBB setup ' + err.message);
				process.exit();
			}

			if (nconf.get('advanced')) {
				prompt.get({
					name: 'secondary_database',
					description: 'Select secondary database',
					'default': nconf.get('secondary_database') || 'none'
				}, function(err, dbConfig) {
					config.secondary_database = dbConfig.secondary_database;
					configureDatabases(err, config, DATABASES, function(err, config) {
						completeConfigSetup(err, config, next);
					});
				});
			} else {
				configureDatabases(err, config, DATABASES, function(err, config) {
					completeConfigSetup(err, config, next);
				});
			}
		});
	} else {
		// Use provided values, fall back to defaults
		var	config = {},
			redisQuestions = require('./database/redis').questions,
			mongoQuestions = require('./database/mongo').questions,
			levelQuestions = require('./database/level').questions,
			question, x, numQ, allQuestions = questions.main.concat(redisQuestions).concat(mongoQuestions.concat(levelQuestions));

		for(x=0,numQ=allQuestions.length;x<numQ;x++) {
			question = allQuestions[x];
			config[question.name] = install.values[question.name] || question['default'] || '';
		}

		configureDatabases(null, config, DATABASES, function(err, config) {
			completeConfigSetup(err, config, next);
		});
	}
}

function completeConfigSetup(err, config, next) {
	if (err) {
		return next(err);
	}
	// Add CI object
	if (install.ciVals) {
		config.test_database = {};
		for(var prop in install.ciVals) {
			if (install.ciVals.hasOwnProperty(prop)) {
				config.test_database[prop] = install.ciVals[prop];
			}
		}
	}

	config.bcrypt_rounds = 12;
	config.upload_path = '/public/uploads';

	var urlObject = url.parse(config.base_url),
		server_conf = config;

	server_conf.base_url = urlObject.protocol + '//' + urlObject.hostname;
	server_conf.use_port = urlObject.port !== null ? true : false;
	server_conf.relative_path = (urlObject.pathname && urlObject.pathname.length > 1) ? urlObject.pathname : '';

	install.save(server_conf, function(err) {
		if (err) {
			return next(err);
		}

		setupDatabase(server_conf, next);
	});
}

function setupDatabase(server_conf, next) {
	install.installDbDependencies(server_conf, function(err) {
		if (err) {
			return next(err);
		}

		require('./database').init(next);
	});
}

install.installDbDependencies = function(server_conf, next) {
	var	npm = require('npm'),
		packages = [];

	npm.load({}, function(err) {
		if (err) {
			next(err);
		}

		npm.config.set('spin', false);

		packages = packages.concat(DATABASES[server_conf.database].dependencies);
		if (server_conf.secondary_database) {
			packages = packages.concat(DATABASES[server_conf.secondary_database].dependencies);
		}

		npm.commands.install(packages, next);
	});
};

function setupDefaultConfigs(next) {
	winston.info('Populating database with default configs, if not already set...');
	var meta = require('./meta'),
		defaults = require(path.join(__dirname, '../', 'install/data/defaults.json'));

	async.each(defaults, function (configObj, next) {
		meta.configs.setOnEmpty(configObj.field, configObj.value, next);
	}, function (err) {
		meta.configs.init(next);
	});

	if (install.values) {
		setOnEmpty('social:twitter:key', 'social:twitter:secret');
		setOnEmpty('social:google:id', 'social:google:secret');
		setOnEmpty('social:facebook:app_id', 'social:facebook:secret');
	}
}

function setOnEmpty(key1, key2) {
	var meta = require('./meta');
	if (install.values[key1] && install.values[key2]) {
		meta.configs.setOnEmpty(key1, install.values[key1]);
		meta.configs.setOnEmpty(key2, install.values[key2]);
	}
}

function enableDefaultTheme(next) {
	var	meta = require('./meta');

	meta.configs.get('theme:id', function(err, id) {
		if (err || id) {
			winston.info('Previous theme detected, skipping enabling default theme');
			return next(err);
		}

		winston.info('Enabling default theme: Lavender');
		meta.themes.set({
			type: 'local',
			id: 'nodebb-theme-lavender'
		}, next);
	});
}

function createAdministrator(next) {
	var Groups = require('./groups');
	Groups.get('administrators', {}, function (err, groupObj) {
		if (!err && groupObj && groupObj.memberCount > 0) {
			winston.info('Administrator found, skipping Admin setup');
			next();
		} else {
			createAdmin(next);
		}
	});
}

function createAdmin(callback) {
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
}

function createCategories(next) {
	var Categories = require('./categories');

	Categories.getAllCategories(0, function (err, categoryData) {
		if (err) {
			return next(err);
		}

		if (Array.isArray(categoryData) && categoryData.length) {
			winston.info('Categories OK. Found ' + categoryData.length + ' categories.');
			return next();
		}

		winston.warn('No categories found, populating instance with default categories');

		fs.readFile(path.join(__dirname, '../', 'install/data/categories.json'), function (err, default_categories) {
			if (err) {
				return next(err);
			}
			default_categories = JSON.parse(default_categories);

			async.eachSeries(default_categories, Categories.create, next);
		});
	});
}

function enableDefaultPlugins(next) {
	var Plugins = require('./plugins');

	winston.info('Enabling default plugins');

	var defaultEnabled = [
		'nodebb-plugin-markdown',
		'nodebb-plugin-mentions',
		'nodebb-widget-essentials',
		'nodebb-plugin-soundpack-default'
	];
	var	db = require('./database');
	db.setAdd('plugins:active', defaultEnabled, next);
}

function setCopyrightWidget(next) {
	var	db = require('./database');

	db.init(function(err) {
		if (!err) {
			db.setObjectField('widgets:global', 'footer', "[{\"widget\":\"html\",\"data\":{\"html\":\"<footer id=\\\"footer\\\" class=\\\"container footer\\\">\\r\\n\\t<div class=\\\"copyright\\\">\\r\\n\\t\\tCopyright © 2014 <a target=\\\"_blank\\\" href=\\\"https://www.nodebb.com\\\">NodeBB Forums</a> | <a target=\\\"_blank\\\" href=\\\"//github.com/NodeBB/NodeBB/graphs/contributors\\\">Contributors</a>\\r\\n\\t</div>\\r\\n</footer>\",\"title\":\"\",\"container\":\"\"}}]", next);
		}
	});
}

install.setup = function (callback) {
	async.series([checkSetupFlag, checkCIFlag, setupConfig, setupDefaultConfigs, enableDefaultTheme, createAdministrator, createCategories, enableDefaultPlugins, setCopyrightWidget,
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
};

install.save = function (server_conf, callback) {
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
};

module.exports = install;
