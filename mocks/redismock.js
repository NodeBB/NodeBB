/**
 * Redis Mock - wrapper for redis.js, makes system use separate test db, instead of production
 * ATTENTION: testing db is flushed before every use!
 */

(function(module) {
	'use strict';

	var RedisDB,
		redis = require('redis'),
		utils = require('./../public/src/utils.js'),
		path  = require('path'),
		nconf = require('nconf'),
		winston = require('winston'),
		errorText;


	nconf.file({ file: path.join(__dirname, '../config.json') });

	var testDbConfig = nconf.get('redis_test'),
		productionDbConfig = nconf.get('redis');
	if(!testDbConfig){
		errorText = 'redis_test database is not defined';
		winston.info(
			"\n===========================================================\n"+
			"Please, add parameters for test database in config.json\n"+
			"For example:\n"+
				'"redis_test": {' + '\n' +
				'   "host": "127.0.0.1",' + '\n' +
				'   "port": "6379",' + '\n' +
				'   "password": "",' + '\n' +
				'   "database": "1"' + '\n' +
			'}\n'+
			"==========================================================="
		);
		winston.error(errorText);
		throw new Error(errorText);
	}

	if(	testDbConfig.database === productionDbConfig.database &&
		testDbConfig.host === productionDbConfig.host &&
		testDbConfig.port === productionDbConfig.port
	){
		errorText = 'redis_test database has the same config as production db';
		winston.error(errorText);
		throw new Error(errorText);
	}

	nconf.set('redis',testDbConfig);

	RedisDB = require('../src/redis.js');


	//Clean up
	RedisDB.send_command('flushdb', [], function(error){
		if(error){
			winston.error(error);
			throw new Error(error);
		} else {
			winston.info('redis_test db flushed');
		}
	});

	//TODO: data seeding, if needed at all


	module.exports = RedisDB;

}(module));
