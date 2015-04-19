'use strict';

var async = require('async'),
	fs = require('fs'),
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
			"dependencies": ["mongodb@~2.0.0", "connect-mongo"]
		}
	};


var install = {},
	questions = {};

questions.main = [
	{
		name: 'url',
		description: 'URL used to access this NodeBB',
		'default':
			nconf.get('url') ||
			(nconf.get('base_url') ? (nconf.get('base_url') + (nconf.get('use_port') ? ':' + nconf.get('port') : '')) : null) ||	// backwards compatibility (remove for v0.7.0)
			'http://localhost:4567',
		pattern: /^http(?:s)?:\/\//,
		message: 'Base URL must begin with \'http://\' or \'https://\'',
	},
	{
		name: 'secret',
		description: 'Please enter a NodeBB secret',
		'default': nconf.get('secret') || utils.generateUUID()
	},
	{
		name: 'database',
		description: 'Which database to use',
		'default': nconf.get('database') || 'redis'
	}
];

questions.optional = [
	{
		name: 'port',
		default: nconf.get('port') || 4567
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
	prompt.colors = false;

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
			question, x, numQ, allQuestions = questions.main.concat(questions.optional).concat(redisQuestions).concat(mongoQuestions);

		for(x=0,numQ=allQuestions.length;x<numQ;x++) {
			question = allQuestions[x];
			config[question.name] = install.values[question.name] || question['default'] || undefined;
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

	install.save(config, function(err) {
		if (err) {
			return next(err);
		}

		setupDatabase(config, next);
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
			return next(err);
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
		setIfPaired('social:twitter:key', 'social:twitter:secret');
		setIfPaired('social:google:id', 'social:google:secret');
		setIfPaired('social:facebook:app_id', 'social:facebook:secret');
	}
}

function setIfPaired(key1, key2) {
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

function createMenuItems(next) {
	var navigation = require('./navigation/admin'),
		data = require('../install/data/navigation.json');

	navigation.save(data, next);
}

function createWelcomePost(next) {
	var db = require('./database'),
		Topics = require('./topics');

	async.parallel([
		function(next) {
			fs.readFile(path.join(__dirname, '../', 'install/data/welcome.md'), next);
		},
		function(next) {
			db.getObjectField('global', 'topicCount', next);
		}
	], function(err, results) {
		var content = results[0],
			numTopics = results[1];

		if (!parseInt(numTopics, 10)) {
			Topics.post({
				uid: 1,
				cid: 2,
				title: 'Welcome to your NodeBB!',
				content: content.toString()
			}, next);
		} else {
			next();
		}
	});
}

function enableDefaultPlugins(next) {
	var Plugins = require('./plugins');

	winston.info('Enabling default plugins');

	var defaultEnabled = [
		'nodebb-plugin-markdown',
		'nodebb-plugin-mentions',
		'nodebb-widget-essentials',
		'nodebb-rewards-essentials',
		'nodebb-plugin-soundpack-default'
	];
	var	db = require('./database');
	var order = defaultEnabled.map(function(plugin, index) {
		return index;
	});
	db.sortedSetAdd('plugins:active', order, defaultEnabled, next);
}

function setCopyrightWidget(next) {
	var	db = require('./database');
	async.parallel({
		footerJSON: function(next) {
			fs.readFile(path.join(__dirname, '../', 'install/data/footer.json'), next);
		},
		footer: function(next) {
			db.getObjectField('widgets:global', 'footer', next);
		}
	}, function(err, results) {
		if (err) {
			return next(err);
		}
		
		if (!results.footer && results.footerJSON) {
			db.setObjectField('widgets:global', 'footer', results.footerJSON.toString(), next);	
		} else {
			next();
		}
	});	
}

install.setup = function (callback) {
	async.series([
		checkSetupFlag,
		checkCIFlag,
		setupConfig,
		setupDefaultConfigs,
		enableDefaultTheme,
		createCategories,
		createAdministrator,
		createMenuItems,
		createWelcomePost,
		enableDefaultPlugins,
		setCopyrightWidget,
		function (next) {
			require('./upgrade').upgrade(next);
		}
	], function (err) {
		if (err) {
			winston.warn('NodeBB Setup Aborted.\n ' + err.stack);
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
