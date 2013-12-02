

(function(module) {
	'use strict';
	var mongoClient,
		mongo = require('mongo')
		winston = require('winston'),
		nconf = require('nconf'),
		mongoHost = nconf.get('mongo:host'),
		utils = require('./../../public/src/utils.js');

	// temp, look this up
	mongoClient = mongo.createClient(nconf.get('mongo:port'), nconf.get('mongo:host'));

	// look up how its done in mongo
	/*if (nconf.get('mongo:password')) {
		redisClient.auth(nconf.get('mongo:password'));
	}

	var db = parseInt(nconf.get('mongo:database'), 10);

	if (db){
		mongoClient.select(db, function(error) {
			if(error) {
				winston.error("NodeBB could not connect to your Redis database. Redis returned the following error: " + error.message);
				process.exit();
			}
		});
	}*/

	//
	// Exported functions
	//
	module.getFileName = function(callback) {
		// TODO : get mongodb filename
	}


	module.setObject = function(key, data, callback) {
		// TODO : implement in mongo
	}

	module.setObjectField = function(key, field, callback) {
		// TODO : implement in mongo
	}

	module.getObject = function(key, callback) {
		// TODO : implement in mongo
	}

	module.getObjectField = function(key, field, callback) {
		// TODO : implement in mongo
	}

	module.getObjectFields = function(key, fields, callback) {
		// TODO : implement in mongo
	}

	module.deleteObjectField = function(key, field, callback) {
		// TODO : implement in mongo
	}

	module.incrObjectField = function(key, field, value, callback) {
		// TODO : implement in mongo
	}





}(exports));

