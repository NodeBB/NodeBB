
'use strict';

(function(module) {

	var winston = require('winston'),
		async = require('async'),
		nconf = require('nconf'),
		session = require('express-session'),
		db, pg;

	module.questions = [
		{
			name: 'postgres:host',
			description: 'Host IP or address of your PostgreSQL instance',
			'default': nconf.get('postgres:host') || '127.0.0.1'
		},
		{
			name: 'postgres:port',
			description: 'Host port of your MongoDB instance',
			'default': nconf.get('postgres:port') || 5432
		},
		{
			name: 'postgres:role',
			description: 'PostgreSQL Role name'
		},
		// {
		// 	name: 'postgres:password',
		// 	description: 'Password of your MongoDB database',
		// 	hidden: true
		// },
		{
			name: "postgres:database",
			description: "Which database to use",
			'default': nconf.get('postgres:database') || 'nodebb'
		}
	];

	module.init = function(callback) {
		try {
			var sessionStore;
			pg = require('pg');

			if (!nconf.get('redis')) {
				sessionStore = require('connect-pg-simple')(session);
			} else {
				sessionStore = require('connect-redis')(session);
			}
		} catch (err) {
			winston.error('Unable to initialize PostgreSQL! Is PostgreSQL installed? Error :' + err.message);
			process.exit(0);
		}

		if (!nconf.get('postgres:password') {
			winston.warn('You have no PostgreSQL password setup!');
		}

		var connString = 'postgres://' + nconf.get('postgres:role') + ':' + nconf.get('postgres:password') + '@' + nconf.get('mongopostgres:host') + ':' + nconf.get('postgres:port') + '/' + nconf.get('postgres:database');
		mongoClient.connect(connString, function(err, _db, done) {
			if(err) {
				winston.error("NodeBB could not connect to your PostgreSQL database. PostgreSQL returned the following error: " + err.message);
				process.exit(0);
			}

			db = _db;
			module.client = db;

			if (!nconf.get('redis')) {
				module.sessionStore = new sessionStore({
					pg: pg,
					conString: conString,
					tableName: 'user_sessions'
				});
			} else {
				module.sessionStore = new sessionStore({
					client: require('./redis').connect(),
					ttl: 60 * 60 * 24 * 14
				});
			}

			require('./postgres/main')(db, module, done);
			require('./postgres/hash')(db, module, done);
			require('./postgres/sets')(db, module, done);
			require('./postgres/sorted')(db, module, done);
			require('./postgres/list')(db, module, done);
		});
	};

	module.close = function() {
		db.close();
	};

}(exports));

