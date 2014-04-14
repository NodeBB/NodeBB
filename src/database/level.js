'use strict';

(function(module) {
	/*
	* Okay, so LevelDB was made by Google. Therefore it's skalable.
	* BUT, I created 99% of the rest of NodeBB's expected functionality out of just simple get and set commands.
	* Therefore, it is unskalable. I totally should have read the docs before starting.
	*
	* With much <3, psychobunny.
	*/


	var winston = require('winston'),
		nconf = require('nconf'),
		path = require('path'),
		async = require('async'),
		express = require('express'),
		utils = require('./../../public/src/utils.js'),
		levelup,
		leveldown,
		connectLevel,
		db;

	module.questions = [
		{
			name: "level:database",
			description: "Enter the path to your Level database",
			'default': nconf.get('level:database') || '/var/level/nodebb'
		}
	];

	module.init = function(callback) {
		try {
			levelup = require('levelup');
			leveldown = require('leveldown');
			connectLevel = require('connect-leveldb')(express);
		} catch (err) {
			winston.error('Unable to initialize Level DB! Is Level DB installed? Error :' + err.message);
			process.exit();
		}

		if (db) {
			if(typeof callback === 'function') {
				callback();
			}

			return;
		}

		db = levelup(nconf.get('level:database'), {
			valueEncoding: 'json'
		});

		leveldown(nconf.get('level:database'));

		db.on('error', function (err) {
			winston.error(err.message);
			process.exit();
		});

		module.client = db;
		module.leveldown = leveldown;

		module.sessionStore = new connectLevel({
			db: db,
			ttl: 60 * 60 * 24 * 14
		});

		require('./level/main')(db, module);
		require('./level/hash')(db, module);
		require('./level/sets')(db, module);
		require('./level/sorted')(db, module);
		require('./level/list')(db, module);

		if(typeof callback === 'function') {
			callback();
		}
	};

	module.close = function(callback) {
		db.close(callback);
	};

	var helpers = {};

	helpers.iterator = function(fn, keys, value, callback) {
		var results = [];

		async.each(keys, function(key, next) {
			module[fn](key, value, function(err, result) {
				results.push(result);
				next();
			});
		}, function(err) {
			callback(err, results);
		});
	};

	module.helpers = module.helpers || {};
	module.helpers.level = helpers;

}(exports));