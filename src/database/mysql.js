'use strict';

(function(module) {

	var winston = require('winston'),
		async = require('async'),
		nconf = require('nconf'),
		session = require('express-session'),
		db, mysqlClient, knex, bookshelf;

	module.questions = [
		{
			name: 'mysql:host',
			description: 'Host IP or address of your MySQL instance',
			'default': nconf.get('mongo:host') || '127.0.0.1'
		},
		{
			name: 'mysql:port',
			description: 'Host port of your MySQL instance',
			'default': nconf.get('mysql:port') || 3306
		},
		{
			name: 'mysql:username',
			description: 'MySQL username'
		},
		{
			name: 'mysql:password',
			description: 'Password of your MySQL database',
			hidden: true
		},
		{
			name: "mysql:database",
			description: "Which database to use",
			'default': nconf.get('mysql:database') || 0
		}
	];

	module.helpers = module.helpers || {};
	module.helpers.mysql = require('./mysql/helpers');

	module.init = function(callback) {
		try {
			
			if (nconf.get('mysql:username') && nconf.get('mysql:password')) {
			
				//initiate knex and bookshelf
				knex = require('knex')({
					client: 'mysql',
					connection: {
					host: nconf.get('mysql:host'),
					user: nconf.get('mysql:username'),
					password: nconf.get('mysql:password'),
					database: nconf.get('mysql:database'),
					port: nconf.get('mysql:port'),
					charset: 'utf8'
					}
				});

				bookshelf = require('bookshelf')(knex);
			}
			
		} catch (err) {
			winston.error('Unable to initialize MySQL! Is MySQL installed? Error :' + err.message);
			return callback(err);
		}

		module.client = knex;
		
		require('./mysql/main')(knex, module);
		require('./mysql/hash')(knex, module);
		require('./mysql/sets')(knex, module);
		require('./mysql/sorted')(knex, module);
		require('./mysql/list')(knex, module);
		
		module.sessionStore = new sessionStore({
			knex: knex,
			bookshelf: bookshelf
		});
		
	};

	module.close = function() {
		knex.close();
	};

	module.helpers = module.helpers || {};
	module.helpers.mysql = require('./mysql/helpers');
	
}(exports));

