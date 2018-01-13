'use strict';

var async = require('async');
var prompt = require('prompt');
var winston = require('winston');

var questions = {
	redis: require('../src/database/redis').questions,
	mongo: require('../src/database/mongo').questions,
	postgres: require('../src/database/postgres').questions,
};

module.exports = function (config, callback) {
	async.waterfall([
		function (next) {
			winston.info('\nNow configuring ' + config.database + ' database:');
			getDatabaseConfig(config, next);
		},
		function (databaseConfig, next) {
			saveDatabaseConfig(config, databaseConfig, next);
		},
	], callback);
};

function getDatabaseConfig(config, callback) {
	if (!config) {
		return callback(new Error('aborted'));
	}

	if (config.database === 'redis') {
		if (config['redis:host'] && config['redis:port']) {
			callback(null, config);
		} else {
			prompt.get(questions.redis, callback);
		}
	} else if (config.database === 'mongo') {
		if ((config['mongo:host'] && config['mongo:port']) || config['mongo:uri']) {
			callback(null, config);
		} else {
			prompt.get(questions.mongo, callback);
		}
	} else if (config.database === 'postgres') {
		if (config['postgres:host'] && config['postgres:port']) {
			callback(null, config);
		} else {
			prompt.get(questions.postgres, callback);
		}
	} else {
		return callback(new Error('unknown database : ' + config.database));
	}
}

function saveDatabaseConfig(config, databaseConfig, callback) {
	if (!databaseConfig) {
		return callback(new Error('aborted'));
	}

	// Translate redis properties into redis object
	if (config.database === 'redis') {
		config.redis = {
			host: databaseConfig['redis:host'],
			port: databaseConfig['redis:port'],
			password: databaseConfig['redis:password'],
			database: databaseConfig['redis:database'],
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
			database: databaseConfig['mongo:database'],
			uri: databaseConfig['mongo:uri'],
		};
	} else if (config.database === 'postgres') {
		config.postgres = {
			host: databaseConfig['postgres:host'],
			port: databaseConfig['postgres:port'],
			username: databaseConfig['postgres:username'],
			password: databaseConfig['postgres:password'],
			database: databaseConfig['postgres:database'],
		};
	} else {
		return callback(new Error('unknown database : ' + config.database));
	}

	var allQuestions = questions.redis.concat(questions.mongo).concat(questions.postgres);
	for (var x = 0; x < allQuestions.length; x += 1) {
		delete config[allQuestions[x].name];
	}

	callback(null, config);
}
