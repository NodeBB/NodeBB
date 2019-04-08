
'use strict';


var winston = require('winston');
var async = require('async');
var nconf = require('nconf');
var session = require('express-session');
var _ = require('lodash');
var semver = require('semver');
var prompt = require('prompt');
var utils = require('../utils');
var client;

var mongoModule = module.exports;

function isUriNotSpecified() {
	return !prompt.history('mongo:uri').value;
}

mongoModule.questions = [
	{
		name: 'mongo:uri',
		description: 'MongoDB connection URI: (leave blank if you wish to specify host, port, username/password and database individually)\nFormat: mongodb://[username:password@]host1[:port1][,host2[:port2],...[,hostN[:portN]]][/[database][?options]]',
		default: nconf.get('mongo:uri') || '',
		hideOnWebInstall: true,
	},
	{
		name: 'mongo:host',
		description: 'Host IP or address of your MongoDB instance',
		default: nconf.get('mongo:host') || '127.0.0.1',
		ask: isUriNotSpecified,
	},
	{
		name: 'mongo:port',
		description: 'Host port of your MongoDB instance',
		default: nconf.get('mongo:port') || 27017,
		ask: isUriNotSpecified,
	},
	{
		name: 'mongo:username',
		description: 'MongoDB username',
		default: nconf.get('mongo:username') || '',
		ask: isUriNotSpecified,
	},
	{
		name: 'mongo:password',
		description: 'Password of your MongoDB database',
		default: nconf.get('mongo:password') || '',
		hidden: true,
		ask: isUriNotSpecified,
		before: function (value) { value = value || nconf.get('mongo:password') || ''; return value; },
	},
	{
		name: 'mongo:database',
		description: 'MongoDB database name',
		default: nconf.get('mongo:database') || 'nodebb',
		ask: isUriNotSpecified,
	},
];

mongoModule.helpers = mongoModule.helpers || {};
mongoModule.helpers.mongo = require('./mongo/helpers');

mongoModule.getConnectionString = function (mongo) {
	mongo = mongo || nconf.get('mongo');
	var usernamePassword = '';
	var uri = mongo.uri || '';
	if (mongo.username && mongo.password) {
		usernamePassword = nconf.get('mongo:username') + ':' + encodeURIComponent(nconf.get('mongo:password')) + '@';
	} else if (!uri.includes('@') || !uri.slice(uri.indexOf('://') + 3, uri.indexOf('@'))) {
		winston.warn('You have no mongo username/password setup!');
	}

	// Sensible defaults for Mongo, if not set
	if (!mongo.host) {
		mongo.host = '127.0.0.1';
	}
	if (!mongo.port) {
		mongo.port = 27017;
	}
	const dbName = mongo.database;
	if (dbName === undefined || dbName === '') {
		winston.warn('You have no database name, using "nodebb"');
		mongo.database = 'nodebb';
	}

	var hosts = mongo.host.split(',');
	var ports = mongo.port.toString().split(',');
	var servers = [];

	for (var i = 0; i < hosts.length; i += 1) {
		servers.push(hosts[i] + ':' + ports[i]);
	}

	return uri || 'mongodb://' + usernamePassword + servers.join() + '/' + mongo.database;
};

mongoModule.getConnectionOptions = function (mongo) {
	mongo = mongo || nconf.get('mongo');
	var connOptions = {
		poolSize: 10,
		reconnectTries: 3600,
		reconnectInterval: 1000,
		autoReconnect: true,
		connectTimeoutMS: 90000,
		useNewUrlParser: true,
	};

	return _.merge(connOptions, mongo.options || {});
};

mongoModule.init = function (callback) {
	callback = callback || function () { };

	mongoModule.connect(nconf.get('mongo'), function (err, _client) {
		if (err) {
			winston.error('NodeBB could not connect to your Mongo database. Mongo returned the following error', err);
			return callback(err);
		}
		client = _client;
		var db = client.db();
		mongoModule.client = db;

		require('./mongo/main')(db, mongoModule);
		require('./mongo/hash')(db, mongoModule);
		require('./mongo/sets')(db, mongoModule);
		require('./mongo/sorted')(db, mongoModule);
		require('./mongo/list')(db, mongoModule);
		require('./mongo/transaction')(db, mongoModule);

		mongoModule.async = require('../promisify')(mongoModule, ['client', 'sessionStore']);

		callback();
	});
};

mongoModule.connect = function (options, callback) {
	callback = callback || function () { };

	var mongoClient = require('mongodb').MongoClient;

	var connString = mongoModule.getConnectionString(options);
	var connOptions = mongoModule.getConnectionOptions(options);

	mongoClient.connect(connString, connOptions, callback);
};

mongoModule.createSessionStore = function (options, callback) {
	mongoModule.connect(options, function (err, client) {
		if (err) {
			return callback(err);
		}
		const meta = require('../meta');
		const sessionStore = require('connect-mongo')(session);
		const store = new sessionStore({
			db: client.db(),
			ttl: meta.getSessionTTLSeconds(),
		});

		callback(null, store);
	});
};

mongoModule.createIndices = function (callback) {
	function createIndex(collection, index, options, callback) {
		mongoModule.client.collection(collection).createIndex(index, options, callback);
	}

	if (!mongoModule.client) {
		winston.warn('[database/createIndices] database not initialized');
		return callback();
	}

	winston.info('[database] Checking database indices.');
	async.series([
		async.apply(createIndex, 'objects', { _key: 1, score: -1 }, { background: true }),
		async.apply(createIndex, 'objects', { _key: 1, value: -1 }, { background: true, unique: true, sparse: true }),
		async.apply(createIndex, 'objects', { expireAt: 1 }, { expireAfterSeconds: 0, background: true }),
	], function (err) {
		if (err) {
			winston.error('Error creating index', err);
			return callback(err);
		}
		winston.info('[database] Checking database indices done!');
		callback();
	});
};

mongoModule.checkCompatibility = function (callback) {
	var mongoPkg = require('mongodb/package.json');
	mongoModule.checkCompatibilityVersion(mongoPkg.version, callback);
};

mongoModule.checkCompatibilityVersion = function (version, callback) {
	if (semver.lt(version, '2.0.0')) {
		return callback(new Error('The `mongodb` package is out-of-date, please run `./nodebb setup` again.'));
	}

	callback();
};

mongoModule.info = function (db, callback) {
	async.waterfall([
		function (next) {
			if (db) {
				return setImmediate(next, null, db);
			}
			mongoModule.connect(nconf.get('mongo'), function (err, client) {
				next(err, client ? client.db() : undefined);
			});
		},
		function (db, next) {
			mongoModule.client = mongoModule.client || db;

			async.parallel({
				serverStatus: function (next) {
					db.command({ serverStatus: 1 }, next);
				},
				stats: function (next) {
					db.command({ dbStats: 1 }, next);
				},
				listCollections: function (next) {
					getCollectionStats(db, next);
				},
			}, next);
		},
		function (results, next) {
			var stats = results.stats || {};
			results.serverStatus = results.serverStatus || {};
			var scale = 1024 * 1024 * 1024;

			results.listCollections = results.listCollections.map(function (collectionInfo) {
				return {
					name: collectionInfo.ns,
					count: collectionInfo.count,
					size: collectionInfo.size,
					avgObjSize: collectionInfo.avgObjSize,
					storageSize: collectionInfo.storageSize,
					totalIndexSize: collectionInfo.totalIndexSize,
					indexSizes: collectionInfo.indexSizes,
				};
			});

			stats.mem = results.serverStatus.mem || {};
			stats.mem.resident = (stats.mem.resident / 1024).toFixed(3);
			stats.mem.virtual = (stats.mem.virtual / 1024).toFixed(3);
			stats.mem.mapped = (stats.mem.mapped / 1024).toFixed(3);
			stats.collectionData = results.listCollections;
			stats.network = results.serverStatus.network || {};
			stats.network.bytesIn = (stats.network.bytesIn / scale).toFixed(3);
			stats.network.bytesOut = (stats.network.bytesOut / scale).toFixed(3);
			stats.network.numRequests = utils.addCommas(stats.network.numRequests);
			stats.raw = JSON.stringify(stats, null, 4);

			stats.avgObjSize = stats.avgObjSize.toFixed(2);
			stats.dataSize = (stats.dataSize / scale).toFixed(3);
			stats.storageSize = (stats.storageSize / scale).toFixed(3);
			stats.fileSize = stats.fileSize ? (stats.fileSize / scale).toFixed(3) : 0;
			stats.indexSize = (stats.indexSize / scale).toFixed(3);
			stats.storageEngine = results.serverStatus.storageEngine ? results.serverStatus.storageEngine.name : 'mmapv1';
			stats.host = results.serverStatus.host;
			stats.version = results.serverStatus.version;
			stats.uptime = results.serverStatus.uptime;
			stats.mongo = true;

			next(null, stats);
		},
	], callback);
};

function getCollectionStats(db, callback) {
	async.waterfall([
		function (next) {
			db.listCollections().toArray(next);
		},
		function (items, next) {
			async.map(items, function (collection, next) {
				db.collection(collection.name).stats(next);
			}, next);
		},
	], callback);
}

mongoModule.close = function (callback) {
	callback = callback || function () {};
	client.close(function (err) {
		callback(err);
	});
};

mongoModule.socketAdapter = function () {
	var mongoAdapter = require('socket.io-adapter-mongo');
	return mongoAdapter(mongoModule.getConnectionString());
};
