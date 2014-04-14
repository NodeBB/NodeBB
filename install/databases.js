"use strict";

var async = require('async'),
	prompt = require('prompt'),
	nconf = require('nconf'),
	winston = require('winston'),

	questions = {};

// maybe this should go into install/database.js
function success(err, config, callback) {
	if (!config) {
		return callback(new Error('aborted'));
	}

	var database = (config.redis || config.mongo || config.level) ? config.secondary_database : config.database;

	function dbQuestionsSuccess(err, databaseConfig) {
		if (!databaseConfig) {
			return callback(new Error('aborted'));
		}

		// Translate redis properties into redis object
		if(database === 'redis') {
			config.redis = {
				host: databaseConfig['redis:host'],
				port: databaseConfig['redis:port'],
				password: databaseConfig['redis:password'],
				database: databaseConfig['redis:database']
			};

			if (config.redis.host.slice(0, 1) === '/') {
				delete config.redis.port;
			}
		} else if (database === 'mongo') {
			config.mongo = {
				host: databaseConfig['mongo:host'],
				port: databaseConfig['mongo:port'],
				username: databaseConfig['mongo:username'],
				password: databaseConfig['mongo:password'],
				database: databaseConfig['mongo:database']
			};
		} else if (database === 'level') {
			config.level = {
				database: databaseConfig['level:database']
			};
		} else {
			return callback(new Error('unknown database : ' + database));
		}

		var allQuestions = questions.redis.concat(questions.mongo.concat(questions.level));
		for(var x=0;x<allQuestions.length;x++) {
			delete config[allQuestions[x].name];
		}

		callback(err, config);
	}

	if(database === 'redis') {
		if (config['redis:host'] && config['redis:port']) {
			dbQuestionsSuccess(null, config);
		} else {
			prompt.get(questions.redis, dbQuestionsSuccess);
		}
	} else if(database === 'mongo') {
		if (config['mongo:host'] && config['mongo:port']) {
			dbQuestionsSuccess(null, config);
		} else {
			prompt.get(questions.mongo, dbQuestionsSuccess);
		}
	} else if(database === 'level') {
		if (config['level:database']) {
			dbQuestionsSuccess(null, config);
		} else {
			prompt.get(questions.level, dbQuestionsSuccess);
		}
	} else {
		return callback(new Error('unknown database : ' + database));
	}
}

function getSecondaryDatabaseModules(config, next) {
	prompt.get({
		"name": "secondary_db_modules",
		"description": "Which database modules should " + config.secondary_database + " store?",
		"default": nconf.get('secondary_db_modules') || "hash, list, sets, sorted"
	}, function(err, db) {
		config.secondary_db_modules = db.secondary_db_modules;
		success(err, config, next);
	});
}

module.exports = function(err, config, allowedDBs, callback) {
	allowedDBs.forEach(function(db) {
		questions[db] = require('./../src/database/' + db).questions;
	});

	async.waterfall([
		function(next) {
			winston.info('Now configuring ' + config.database + ' database:');
			success(err, config, next);
		},
		function(config, next) {
			winston.info('Now configuring ' + config.secondary_database + ' database:');
			if (config.secondary_database && allowedDBs.indexOf(config.secondary_database) !== -1) {
				getSecondaryDatabaseModules(config, next);
			} else {
				next(err, config);
			}
		}
	], callback);
};