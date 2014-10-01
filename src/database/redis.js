'use strict';

(function(module) {

	var winston = require('winston'),
		nconf = require('nconf'),
		path = require('path'),
		session = require('express-session'),
		utils = require('./../../public/src/utils.js'),
		redis,
		connectRedis,
		reds,
		redisClient,
		postSearch,
		topicSearch;

	module.questions = [
		{
			name: 'redis:host',
			description: 'Host IP or address of your Redis instance',
			'default': nconf.get('redis:host') || '127.0.0.1'
		},
		{
			name: 'redis:port',
			description: 'Host port of your Redis instance',
			'default': nconf.get('redis:port') || 6379
		},
		{
			name: 'redis:password',
			description: 'Password of your Redis database',
			hidden: true
		},
		{
			name: "redis:database",
			description: "Which database to use (0..n)",
			'default': nconf.get('redis:database') || 0
		}
	];

	module.init = function(callback) {
		try {
			redis = require('redis');
			connectRedis = require('connect-redis')(session);
			reds = require('reds');
		} catch (err) {
			winston.error('Unable to initialize Redis! Is Redis installed? Error :' + err.message);
			process.exit();
		}

		redisClient = module.connect();

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

		require('./redis/main')(redisClient, module);
		require('./redis/hash')(redisClient, module);
		require('./redis/sets')(redisClient, module);
		require('./redis/sorted')(redisClient, module);
		require('./redis/list')(redisClient, module);

		if(typeof callback === 'function') {
			callback();
		}
	};

	module.connect = function() {
		var redis_socket_or_host = nconf.get('redis:host'),
			cxn, dbIdx;

		if (!redis) redis = require('redis');

		if (redis_socket_or_host && redis_socket_or_host.indexOf('/') >= 0) {
			/* If redis.host contains a path name character, use the unix dom sock connection. ie, /tmp/redis.sock */
			cxn = redis.createClient(nconf.get('redis:host'));
		} else {
			/* Else, connect over tcp/ip */
			cxn = redis.createClient(nconf.get('redis:port'), nconf.get('redis:host'));
		}

		if (nconf.get('redis:password')) {
			cxn.auth(nconf.get('redis:password'));
		}

		dbIdx = parseInt(nconf.get('redis:database'), 10);
		if (dbIdx) {
			cxn.select(dbIdx, function(error) {
				if(error) {
					winston.error("NodeBB could not connect to your Redis database. Redis returned the following error: " + error.message);
					process.exit();
				}
			});
		}

		cxn.on('error', function (err) {
			winston.error(err.stack);
			process.exit(1);
		});

		return cxn;
	};

	module.close = function() {
		redisClient.quit();
	};

	module.helpers = module.helpers || {};
	module.helpers.redis = require('./redis/helpers');
}(exports));

