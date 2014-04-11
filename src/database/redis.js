'use strict';

(function(module) {

	var winston = require('winston'),
		nconf = require('nconf'),
		path = require('path'),
		express = require('express'),
		redis_socket_or_host = nconf.get('redis:host'),
		utils = require('./../../public/src/utils.js'),
		redis,
		connectRedis,
		reds,
		redisClient,
		postSearch,
		topicSearch;

	try {
		redis = require('redis');
		connectRedis = require('connect-redis')(express);
		reds = require('reds');
	} catch (err) {
		winston.error('Unable to initialize Redis! Is Redis installed? Error :' + err.message);
		process.exit();
	}

	module.init = function(callback) {
		if (redis_socket_or_host && redis_socket_or_host.indexOf('/')>=0) {
			/* If redis.host contains a path name character, use the unix dom sock connection. ie, /tmp/redis.sock */
			redisClient = redis.createClient(nconf.get('redis:host'));
		} else {
			/* Else, connect over tcp/ip */
			redisClient = redis.createClient(nconf.get('redis:port'), nconf.get('redis:host'));
		}

		if (nconf.get('redis:password')) {
			redisClient.auth(nconf.get('redis:password'));
		} else {
			winston.warn('You have no redis password setup!');
		}

		redisClient.on('error', function (err) {
			winston.error(err.message);
			process.exit();
		});

		module.client = redisClient;

		module.sessionStore = new connectRedis({
			client: redisClient,
			ttl: 60 * 60 * 24 * 14
		});

		reds.createClient = function () {
			return reds.client || (reds.client = redisClient);
		};

		module.postSearch = reds.createSearch('nodebbpostsearch');
		module.topicSearch = reds.createSearch('nodebbtopicsearch');

		var db = parseInt(nconf.get('redis:database'), 10);

		if (db) {
			redisClient.select(db, function(error) {
				if(error) {
					winston.error("NodeBB could not connect to your Redis database. Redis returned the following error: " + error.message);
					process.exit();
				}
			});
		}

		require('./redis/main')(redisClient, module);
		require('./redis/hash')(redisClient, module);
		require('./redis/sets')(redisClient, module);
		require('./redis/sorted')(redisClient, module);
		require('./redis/list')(redisClient, module);

		if(typeof callback === 'function') {
			callback();
		}
	};
}(exports));

