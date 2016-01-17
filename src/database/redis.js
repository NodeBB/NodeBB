'use strict';

(function(module) {

	var winston = require('winston'),
		nconf = require('nconf'),
		semver = require('semver'),
		session = require('express-session'),
		redis,
		connectRedis,
		redisClient;

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
			hidden: true,
			before: function(value) { value = value || nconf.get('redis:password') || ''; return value; }
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

		require('./redis/main')(redisClient, module);
		require('./redis/hash')(redisClient, module);
		require('./redis/sets')(redisClient, module);
		require('./redis/sorted')(redisClient, module);
		require('./redis/list')(redisClient, module);

		if(typeof callback === 'function') {
			callback();
		}
	};

	module.connect = function(options) {
		var redis_socket_or_host = nconf.get('redis:host'),
			cxn, dbIdx;

		options = options || {};

		if (!redis) {
			redis = require('redis');
		}

		if (redis_socket_or_host && redis_socket_or_host.indexOf('/') >= 0) {
			/* If redis.host contains a path name character, use the unix dom sock connection. ie, /tmp/redis.sock */
			cxn = redis.createClient(nconf.get('redis:host'), options);
		} else {
			/* Else, connect over tcp/ip */
			cxn = redis.createClient(nconf.get('redis:port'), nconf.get('redis:host'), options);
		}

		cxn.on('error', function (err) {
			winston.error(err.stack);
			process.exit(1);
		});

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

		return cxn;
	};

	module.checkCompatibility = function(callback) {
		module.info(module.client, function(err, info) {
			if (err) {
				return callback(err);
			}

			if (semver.lt(info.redis_version, '2.8.9')) {
				err = new Error('Your Redis version is not new enough to support NodeBB, please upgrade Redis to v2.8.9 or higher.');
				err.stacktrace = false;
			}

			callback(err);
		});
	};

	module.close = function() {
		redisClient.quit();
	};

	module.info = function(cxn, callback) {
		cxn.info(function (err, data) {
			if (err) {
				return callback(err);
			}

			var lines = data.toString().split("\r\n").sort();
			var redisData = {};
			lines.forEach(function (line) {
				var parts = line.split(':');
				if (parts[1]) {
					redisData[parts[0]] = parts[1];
				}
			});

			redisData.raw = JSON.stringify(redisData, null, 4);
			redisData.redis = true;

			callback(null, redisData);
		});
	};

	module.helpers = module.helpers || {};
	module.helpers.redis = require('./redis/helpers');
}(exports));

