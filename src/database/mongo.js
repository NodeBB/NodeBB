

(function(module) {
	'use strict';
	var mongodb = require('mongodb')
		mongoClient = mongodb.MongoClient,
		winston = require('winston'),
		nconf = require('nconf'),
		express = require('express'),
		mongoStore = require('connect-mongo')(express);
		mongoHost = nconf.get('mongo:host');


	// mongoClient.connect("mongodb://localhost:27017/exampleDb", function(err, db) {
	mongoClient.connect('mongodb://' + mongoHost + ':' + nconf.get('mongo:port') + '/' + nconf.get('mongo:database'), function(err, db) {
		if(err) {
			winston.error("NodeBB could not connect to your Mongo database. Mongo returned the following error: " + error.message);
			process.exit();
		}
	});

	// look up how its done in mongo
	/*if (nconf.get('mongo:password')) {
		redisClient.auth(nconf.get('mongo:password'));
	}
	*/

	// TODO: fill out settings.db
	module.sessionStore = new mongoStore({
		db: settings.db
	});



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

