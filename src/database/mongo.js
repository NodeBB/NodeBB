
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
		callback = callback || function() {};
		try {
			var sessionStore;
			mongoClient = require('mongodb').MongoClient;

			if (!nconf.get('redis')) {
				sessionStore = require('connect-mongo')(session);
			} else {
				sessionStore = require('connect-redis')(session);
			}
		} catch (err) {
			winston.error('Unable to initialize MongoDB! Is MongoDB installed? Error :' + err.message);
			return callback(err);
		}

		var usernamePassword = '';
		if (nconf.get('mongo:username') && nconf.get('mongo:password')) {
			usernamePassword = nconf.get('mongo:username') + ':' + nconf.get('mongo:password') + '@';
		}

		// Sensible defaults for Mongo, if not set
		if (!nconf.get('mongo:host')) {
			nconf.set('mongo:host', '127.0.0.1');
		}
		if (!nconf.get('mongo:port')) {
			nconf.set('mongo:port', 27017);
		}
		if (!nconf.get('mongo:database')) {
			nconf.set('mongo:database', '0');
		}

		var connString = 'mongodb://' + usernamePassword + nconf.get('mongo:host') + ':' + nconf.get('mongo:port') + '/' + nconf.get('mongo:database');
		var connOptions = {
			server: {
				poolSize: parseInt(nconf.get('mongo:poolSize'), 10) || 10
			}
		};
		mongoClient.connect(connString, connOptions, function(err, _db) {
			if (err) {
				winston.error("NodeBB could not connect to your Mongo database. Mongo returned the following error: " + err.message);
				return callback(err);
			}

			db = _db;

			module.client = db;

			if (!nconf.get('redis')) {
				// TEMP: to fix connect-mongo, see https://github.com/kcbanner/connect-mongo/issues/161
				db.openCalled = true;
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
				async.parallel([
					async.apply(createIndex, 'objects', {_key: 1, score: -1}, {background: true}),
					async.apply(createIndex, 'objects', {_key: 1, value: -1}, {background: true}),

					async.apply(createIndex, 'objects', {expireAt: 1}, {expireAfterSeconds: 0, background: true}),

					async.apply(createIndex, 'searchtopic', {content: 'text', uid: 1, cid: 1}, {background: true}),
					async.apply(createIndex, 'searchtopic', {id: 1}, {background: true}),

					async.apply(createIndex, 'searchpost', {content: 'text', uid: 1, cid: 1}, {background: true}),
					async.apply(createIndex, 'searchpost', {id: 1}, {background: true})
				], callback);
			}

			function createIndex(collection, index, options, callback) {
				db.collection(collection).ensureIndex(index, options, function(err) {
					if (err) {
						winston.error('Error creating index ' + err.message);
					}
					callback(err);
				});
			}
		});
	};

	module.close = function() {
		db.close();
	};

}(exports));

