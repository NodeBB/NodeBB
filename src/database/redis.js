

(function(module) {
	'use strict';
	var RedisDB,
		redis = require('redis'),
		winston = require('winston'),
		nconf = require('nconf'),
		redis_socket_or_host = nconf.get('redis:host'),
		utils = require('./../public/src/utils.js');

	if (redis_socket_or_host && redis_socket_or_host.indexOf('/')>=0) {
		/* If redis.host contains a path name character, use the unix dom sock connection. ie, /tmp/redis.sock */
		RedisDB = redis.createClient(nconf.get('redis:host'));
	} else {
		/* Else, connect over tcp/ip */
		RedisDB = redis.createClient(nconf.get('redis:port'), nconf.get('redis:host'));
	}

	if (nconf.get('redis:password')) {
		RedisDB.auth(nconf.get('redis:password'));
	}

	var db = parseInt(nconf.get('redis:database'), 10);

	if (db){
		RedisDB.select(db, function(error){
			if(error !== null){
				winston.error("NodeBB could not connect to your Redis database. Redis returned the following error: " + error.message);
				process.exit();
			}
		});
	}

	RedisDB.handle = function(error) {
		if (error !== null) {
			winston.err(error);
			if (global.env !== 'production') {
				throw new Error(error);
			}
		}
	};


	/*
	 * A possibly more efficient way of doing multiple sismember calls
	 */
	RedisDB.sismembers = function(key, needles, callback) {
		var tempkey = key + ':temp:' + utils.generateUUID();
		RedisDB.sadd(tempkey, needles, function() {
			RedisDB.sinter(key, tempkey, function(err, data) {
				RedisDB.del(tempkey);
				callback(err, data);
			});
		});
	};

	/*
	 * gets fields of a hash as an object instead of an array
	 */
	RedisDB.hmgetObject = function(key, fields, callback) {
		RedisDB.hmget(key, fields, function(err, data) {

			if(err) {
				return callback(err, null);
			}

			var returnData = {};

			for (var i = 0, ii = fields.length; i < ii; ++i) {
				returnData[fields[i]] = data[i];
			}

			callback(null, returnData);
		});
	};

	module.exports = RedisDB;


}(exports));

