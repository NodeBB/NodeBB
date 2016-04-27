
'use strict';

(function(module) {

	var winston = require('winston'),
		async = require('async'),
		nconf = require('nconf'),
		session = require('express-session'),
		_ = require('underscore'),
		semver = require('semver'),
		db, mongoClient;

	_.mixin(require('underscore.deep'));

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
			description: 'MongoDB username',
			'default': nconf.get('mongo:username') || ''
		},
		{
			name: 'mongo:password',
			description: 'Password of your MongoDB database',
			hidden: true,
			before: function(value) { value = value || nconf.get('mongo:password') || ''; return value; }
		},
		{
			name: "mongo:database",
			description: "MongoDB database name",
			'default': nconf.get('mongo:database') || 'nodebb'
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
				sessionStore = require('connect-mongo/es5')(session);
			} else {
				sessionStore = require('connect-redis')(session);
			}
		} catch (err) {
			winston.error('Unable to initialize MongoDB! Is MongoDB installed? Error :' + err.message);
			return callback(err);
		}

		var usernamePassword = '';
		if (nconf.get('mongo:username') && nconf.get('mongo:password')) {
			usernamePassword = nconf.get('mongo:username') + ':' + encodeURIComponent(nconf.get('mongo:password')) + '@';
		}

		// Sensible defaults for Mongo, if not set
		if (!nconf.get('mongo:host')) {
			nconf.set('mongo:host', '127.0.0.1');
		}
		if (!nconf.get('mongo:port')) {
			nconf.set('mongo:port', 27017);
		}
		if (!nconf.get('mongo:database')) {
			nconf.set('mongo:database', 'nodebb');
		}

		var hosts = nconf.get('mongo:host').split(',');
		var ports = nconf.get('mongo:port').toString().split(',');
		var servers = [];

		for (var i = 0; i < hosts.length; i++) {
			servers.push(hosts[i] + ':' + ports[i]);
		}

		var connString = 'mongodb://' + usernamePassword + servers.join() + '/' + nconf.get('mongo:database');

		var connOptions = {
			server: {
				poolSize: parseInt(nconf.get('mongo:poolSize'), 10) || 10
			}
		};

		connOptions = _.deepExtend((nconf.get('mongo:options') || {}), connOptions);

		mongoClient.connect(connString, connOptions, function(err, _db) {
			if (err) {
				winston.error("NodeBB could not connect to your Mongo database. Mongo returned the following error: " + err.message);
				return callback(err);
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

			if (nconf.get('mongo:password') && nconf.get('mongo:username')) {
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
				winston.info('[database] Checking database indices.');
				async.parallel([
					async.apply(createIndex, 'objects', {_key: 1, score: -1}, {background: true}),
					async.apply(createIndex, 'objects', {_key: 1, value: -1}, {background: true, unique: true, sparse: true}),
					async.apply(createIndex, 'objects', {expireAt: 1}, {expireAfterSeconds: 0, background: true})
				], function(err) {
					if (err) {
						winston.error('Error creating index ' + err.message);
					}
					callback(err);
				});
			}

			function createIndex(collection, index, options, callback) {
				db.collection(collection).ensureIndex(index, options, callback);
			}
		});
	};

	module.checkCompatibility = function(callback) {
		var mongoPkg = require.main.require('./node_modules/mongodb/package.json'),
			err = semver.lt(mongoPkg.version, '2.0.0') ? new Error('The `mongodb` package is out-of-date, please run `./nodebb setup` again.') : null;

		if (err) {
			err.stacktrace = false;
		}
		callback(err);
	};

	module.info = function(db, callback) {
		async.parallel({
			serverStatus: function(next) {
				db.command({'serverStatus': 1}, next);
			},
			stats: function(next) {
				db.command({'dbStats': 1}, next);
			},
			listCollections: function(next) {
				db.listCollections().toArray(function(err, items) {
					if (err) {
						return next(err);
					}
					async.map(items, function(collection, next) {
						db.collection(collection.name).stats(next);
					}, next);
				});
			}
		}, function(err, results) {
			if (err) {
				return callback(err);
			}
			var stats = results.stats;
			var scale = 1024 * 1024;

			results.listCollections = results.listCollections.map(function(collectionInfo) {
				return {
					name: collectionInfo.ns,
					count: collectionInfo.count,
					size: collectionInfo.size,
					avgObjSize: collectionInfo.avgObjSize,
					storageSize: collectionInfo.storageSize,
					totalIndexSize: collectionInfo.totalIndexSize,
					indexSizes: collectionInfo.indexSizes
				};
			});

			stats.mem = results.serverStatus.mem;
			stats.collectionData = results.listCollections;
			stats.network = results.serverStatus.network;
			stats.raw = JSON.stringify(stats, null, 4);

			stats.avgObjSize = stats.avgObjSize.toFixed(2);
			stats.dataSize = (stats.dataSize / scale).toFixed(2);
			stats.storageSize = (stats.storageSize / scale).toFixed(2);
			stats.fileSize = stats.fileSize ? (stats.fileSize / scale).toFixed(2) : 0;
			stats.indexSize = (stats.indexSize / scale).toFixed(2);
			stats.storageEngine = results.serverStatus.storageEngine ? results.serverStatus.storageEngine.name : 'mmapv1';
			stats.host = results.serverStatus.host;
			stats.version = results.serverStatus.version;
			stats.uptime = results.serverStatus.uptime;
			stats.mongo = true;

			callback(null, stats);
		});
	};

	module.close = function() {
		db.close();
	};

}(exports));
