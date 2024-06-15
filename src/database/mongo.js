
'use strict';


const winston = require('winston');
const nconf = require('nconf');
const semver = require('semver');
const prompt = require('prompt');
const utils = require('../utils');

let client;

const connection = require('./mongo/connection');

const mongoModule = module.exports;

function isUriNotSpecified() {
	return !prompt.history('mongo:uri').value;
}

mongoModule.questions = [
	{
		name: 'mongo:uri',
		description: 'MongoDB connection URI: (leave blank if you wish to specify host, port, username/password and database individually)\nFormat: mongodb://[username:password@]host1[:port1][,host2[:port2],...[,hostN[:portN]]][/[database][?options]]',
		default: nconf.get('mongo:uri') || nconf.get('defaults:mongo:uri') || '',
		hideOnWebInstall: true,
	},
	{
		name: 'mongo:host',
		description: 'Host IP or address of your MongoDB instance',
		default: nconf.get('mongo:host') || nconf.get('defaults:mongo:host') || '127.0.0.1',
		ask: isUriNotSpecified,
	},
	{
		name: 'mongo:port',
		description: 'Host port of your MongoDB instance',
		default: nconf.get('mongo:port') || nconf.get('defaults:mongo:port') || 27017,
		ask: isUriNotSpecified,
	},
	{
		name: 'mongo:username',
		description: 'MongoDB username',
		default: nconf.get('mongo:username') || nconf.get('defaults:mongo:username') || '',
		ask: isUriNotSpecified,
	},
	{
		name: 'mongo:password',
		description: 'Password of your MongoDB database',
		default: nconf.get('mongo:password') || nconf.get('defaults:mongo:password') || '',
		hidden: true,
		ask: isUriNotSpecified,
		before: function (value) { value = value || nconf.get('mongo:password') || ''; return value; },
	},
	{
		name: 'mongo:database',
		description: 'MongoDB database name',
		default: nconf.get('mongo:database') || nconf.get('defaults:mongo:database') || 'nodebb',
		ask: isUriNotSpecified,
	},
];

mongoModule.init = async function (opts) {
	client = await connection.connect(opts || nconf.get('mongo'));
	mongoModule.client = client.db();
};

mongoModule.createSessionStore = async function (options) {
	const MongoStore = require('connect-mongo');
	const meta = require('../meta');

	const store = MongoStore.create({
		clientPromise: connection.connect(options),
		ttl: meta.getSessionTTLSeconds(),
	});

	return store;
};

mongoModule.createIndices = async function () {
	if (!mongoModule.client) {
		winston.warn('[database/createIndices] database not initialized');
		return;
	}

	winston.info('[database] Checking database indices.');
	const collection = mongoModule.client.collection('objects');
	await collection.createIndex({ _key: 1, score: -1 }, { background: true });
	await collection.createIndex({ _key: 1, value: -1 }, { background: true, unique: true, sparse: true });
	await collection.createIndex({ expireAt: 1 }, { expireAfterSeconds: 0, background: true });
	winston.info('[database] Checking database indices done!');
};

mongoModule.checkCompatibility = function (callback) {
	const mongoPkg = require('mongodb/package.json');
	mongoModule.checkCompatibilityVersion(mongoPkg.version, callback);
};

mongoModule.checkCompatibilityVersion = function (version, callback) {
	if (semver.lt(version, '2.0.0')) {
		return callback(new Error('The `mongodb` package is out-of-date, please run `./nodebb setup` again.'));
	}

	callback();
};

mongoModule.info = async function (db) {
	if (!db) {
		const client = await connection.connect(nconf.get('mongo'));
		db = client.db();
	}
	mongoModule.client = mongoModule.client || db;
	let serverStatusError = '';

	async function getServerStatus() {
		try {
			return await db.command({ serverStatus: 1 });
		} catch (err) {
			serverStatusError = err.message;
			// Override mongo error with more human-readable error
			if (err.name === 'MongoError' && err.codeName === 'Unauthorized') {
				serverStatusError = '[[admin/advanced/database:mongo.unauthorized]]';
			}
			winston.error(err.stack);
		}
	}

	let [serverStatus, stats, listCollections] = await Promise.all([
		getServerStatus(),
		db.command({ dbStats: 1 }),
		getCollectionStats(db),
	]);
	stats = stats || {};
	serverStatus = serverStatus || {};
	stats.serverStatusError = serverStatusError;
	const scale = 1024 * 1024 * 1024;

	listCollections = listCollections.map(collectionInfo => ({
		name: collectionInfo.ns,
		count: collectionInfo.count,
		size: collectionInfo.storageStats && collectionInfo.storageStats.size,
		avgObjSize: collectionInfo.storageStats && collectionInfo.storageStats.avgObjSize,
		storageSize: collectionInfo.storageStats && collectionInfo.storageStats.storageSize,
		totalIndexSize: collectionInfo.storageStats && collectionInfo.storageStats.totalIndexSize,
		indexSizes: collectionInfo.storageStats && collectionInfo.storageStats.indexSizes,
	}));

	stats.mem = serverStatus.mem || { resident: 0, virtual: 0 };
	stats.mem.resident = (stats.mem.resident / 1024).toFixed(3);
	stats.mem.virtual = (stats.mem.virtual / 1024).toFixed(3);
	stats.collectionData = listCollections;
	stats.network = serverStatus.network || { bytesIn: 0, bytesOut: 0, numRequests: 0 };
	stats.network.bytesIn = (stats.network.bytesIn / scale).toFixed(3);
	stats.network.bytesOut = (stats.network.bytesOut / scale).toFixed(3);
	stats.network.numRequests = utils.addCommas(stats.network.numRequests);
	stats.raw = JSON.stringify(stats, null, 4);

	stats.avgObjSize = stats.avgObjSize.toFixed(2);
	stats.dataSize = (stats.dataSize / scale).toFixed(3);
	stats.storageSize = (stats.storageSize / scale).toFixed(3);
	stats.fileSize = stats.fileSize ? (stats.fileSize / scale).toFixed(3) : 0;
	stats.indexSize = (stats.indexSize / scale).toFixed(3);
	stats.storageEngine = serverStatus.storageEngine ? serverStatus.storageEngine.name : 'mmapv1';
	stats.host = serverStatus.host;
	stats.version = serverStatus.version;
	stats.uptime = serverStatus.uptime;
	stats.mongo = true;
	return stats;
};

async function getCollectionStats(db) {
	const items = await db.listCollections().toArray();
	const cols = await Promise.all(
		items.map(
			collection => db.collection(collection.name).aggregate([
				{ $collStats: { latencyStats: {}, storageStats: {}, count: {} } },
			]).toArray()
		)
	);
	return cols.map(col => col[0]);
}

mongoModule.close = async function () {
	await client.close();
	if (mongoModule.objectCache) {
		mongoModule.objectCache.reset();
	}
};

require('./mongo/main')(mongoModule);
require('./mongo/hash')(mongoModule);
require('./mongo/sets')(mongoModule);
require('./mongo/sorted')(mongoModule);
require('./mongo/list')(mongoModule);
require('./mongo/transaction')(mongoModule);

require('../promisify')(mongoModule, ['client', 'sessionStore']);
