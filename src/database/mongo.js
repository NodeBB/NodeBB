
'use strict';


var winston = require('winston');
var async = require('async');
var nconf = require('nconf');
var session = require('express-session');
var _ = require('lodash');
var semver = require('semver');
var prompt = require('prompt');
var db;
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

mongoModule.getConnectionString = function () {
	var usernamePassword = '';
	if (nconf.get('mongo:username') && nconf.get('mongo:password')) {
		usernamePassword = nconf.get('mongo:username') + ':' + encodeURIComponent(nconf.get('mongo:password')) + '@';
	} else {
		winston.warn('You have no mongo username/password setup!');
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

	for (var i = 0; i < hosts.length; i += 1) {
		servers.push(hosts[i] + ':' + ports[i]);
	}

	return nconf.get('mongo:uri') || 'mongodb://' + usernamePassword + servers.join() + '/' + nconf.get('mongo:database');
};

mongoModule.getConnectionOptions = function () {
	var connOptions = {
		poolSize: 10,
		reconnectTries: 3600,
		reconnectInterval: 1000,
		autoReconnect: true,
		useNewUrlParser: true,
	};

	return _.merge(connOptions, nconf.get('mongo:options') || {});
};

mongoModule.init = function (callback) {
	callback = callback || function () { };

	var mongoClient = require('mongodb').MongoClient;

	var connString = mongoModule.getConnectionString();
	var connOptions = mongoModule.getConnectionOptions();

	mongoClient.connect(connString, connOptions, function (err, _client) {
		if (err) {
			winston.error('NodeBB could not connect to your Mongo database. Mongo returned the following error', err);
			return callback(err);
		}
		client = _client;
		db = client.db();
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

mongoModule.initSessionStore = function (callback) {
	var meta = require('../meta');
	var sessionStore;

	var ttl = meta.getSessionTTLSeconds();

	if (nconf.get('redis')) {
		sessionStore = require('connect-redis')(session);
		var rdb = require('./redis');
		rdb.client = rdb.connect();

		mongoModule.sessionStore = new sessionStore({
			client: rdb.client,
			ttl: ttl,
		});
	} else if (nconf.get('mongo')) {
		sessionStore = require('connect-mongo')(session);
		mongoModule.sessionStore = new sessionStore({
			db: db,
			ttl: ttl,
		});
	}

	callback();
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
	if (!db) {
		return callback();
	}
	async.waterfall([
		function (next) {
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
			var stats = results.stats;
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

			stats.mem = results.serverStatus.mem;
			stats.mem = results.serverStatus.mem;
			stats.mem.resident = (stats.mem.resident / 1024).toFixed(3);
			stats.mem.virtual = (stats.mem.virtual / 1024).toFixed(3);
			stats.mem.mapped = (stats.mem.mapped / 1024).toFixed(3);
			stats.collectionData = results.listCollections;
			stats.network = results.serverStatus.network;
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
