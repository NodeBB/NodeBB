
'use strict';

(function(module) {

	var winston = require('winston'),
		async = require('async'),
		nconf = require('nconf'),
		session = require('express-session'),
		db, mongoClient;

	module.questions = [
		{
			name: 'mongo:host',
			description: 'Host IP or address of your MongoDB instance',
			'default': nconf.get('mongo:host') || '127.0.0.1'
		},
		{
			name: 'mongo:port',
			description: 'Host port of your MongoDB instance',
			'default': nconf.get('mongo:port') || 27017
		},
		{
			name: 'mongo:username',
			description: 'MongoDB username'
		},
		{
			name: 'mongo:password',
			description: 'Password of your MongoDB database',
			hidden: true
		},
		{
			name: "mongo:database",
			description: "Which database to use",
			'default': nconf.get('mongo:database') || 0
		}
	];

	module.helpers = module.helpers || {};
	module.helpers.mongo = require('./mongo/helpers');

	module.init = function(callback) {
		try {
			var sessionStore;
			mongoClient = require('mongodb').MongoClient;

			if (!nconf.get('redis')) {
				sessionStore = require('connect-mongo')({session: session});
			} else {
				sessionStore = require('connect-redis')(session);
			}
		} catch (err) {
			winston.error('Unable to initialize MongoDB! Is MongoDB installed? Error :' + err.message);
			process.exit();
		}
		var connString = 'mongodb://'+ nconf.get('mongo:host') + ':' + nconf.get('mongo:port') + '/' + nconf.get('mongo:database');
		var connOptions = {
			server: {
				poolSize: nconf.get('mongo:poolSize') || 10
			}
		};
		mongoClient.connect(connString, connOptions, function(err, _db) {
			if(err) {
				winston.error("NodeBB could not connect to your Mongo database. Mongo returned the following error: " + err.message);
				process.exit();
			}

			db = _db;

			module.client = db;

			if (!nconf.get('redis')) {
				module.sessionStore = new sessionStore({
					db: db
				});
			} else {
				module.sessionStore = new sessionStore({
					client: require('./redis').connect(),
					ttl: 60 * 60 * 24 * 14
				});
			}

			require('./mongo/main')(db, module);
			require('./mongo/hash')(db, module);
			require('./mongo/sets')(db, module);
			require('./mongo/sorted')(db, module);
			require('./mongo/list')(db, module);

			if(nconf.get('mongo:password') && nconf.get('mongo:username')) {
				db.authenticate(nconf.get('mongo:username'), nconf.get('mongo:password'), function (err) {
					if (err) {
						winston.error(err.stack);
						process.exit();
					}
					createIndices();
				});
			} else {
				winston.warn('You have no mongo password setup!');
				createIndices();
			}

			function createIndices() {
				db.collection('objects').ensureIndex({_key :1, score: -1}, {background:true}, function(err) {
					if(err) {
						winston.error('Error creating index ' + err.message);
					}
				});

				db.collection('objects').ensureIndex({_key :1, value: -1}, {background:true}, function(err) {
					if(err) {
						winston.error('Error creating index ' + err.message);
					}
				});

				db.collection('objects').ensureIndex({'expireAt':1}, {expireAfterSeconds:0, background:true}, function(err) {
					if(err) {
						winston.error('Error creating index ' + err.message);
					}
				});

				db.collection('search').ensureIndex({content:'text'}, {background:true}, function(err) {
					if(err) {
						winston.error('Error creating index ' + err.message);
					}
				});

				db.collection('search').ensureIndex({key: 1, id: 1}, {background: true}, function(err) {
					if(err) {
						winston.error('Error creating index ' + err.message);
					}
				});

				if(typeof callback === 'function') {
					callback();
				}
			}
		});
	};

	module.close = function() {
		db.close();
	};

}(exports));

