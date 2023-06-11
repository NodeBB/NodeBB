
'use strict';


const winston = require('winston');
const nconf = require('nconf');
const semver = require('semver');
const prompt = require('prompt');
const utils = require('../utils');

let client;

const connection = require('./tigris/connection');

const tigrisModule = module.exports;

function isUriNotSpecified() {
	return !prompt.history('tigris:uri').value;
}

tigrisModule.questions = [
	{
		name: 'tigris:uri',
		description: 'Uri of your tigris database, leave blank if you wish to specify host, port, username/password and database individually.',
		default: nconf.get('tigris:host') || '',
	},
	{
		name: 'tigris:host',
		description: 'Host IP or address of your tigrisDB instance',
		default: nconf.get('tigris:host') || 'api.preview.tigrisdata.cloud',
		ask: isUriNotSpecified,
	},
	{
		name: 'tigris:clientid',
		description: 'TigrisDB Client ID',
		default: nconf.get('tigris:clientid') || '',
		ask: isUriNotSpecified,
	},
	{
		name: 'tigris:clientsecret',
		description: 'Client Secret of your TigrisDB database',
		default: nconf.get('tigris:clientsecret') || '',
		hidden: true,
		ask: isUriNotSpecified,
		before: function (value) { value = value || nconf.get('tigris:clientsecret') || ''; return value; },
	},
	{
		name: 'tigris:database',
		description: 'TigrisDB database name',
		default: nconf.get('tigris:database') || 'nodebb',
		ask: isUriNotSpecified,
	},
	{
		name: 'tigris:branch',
		description: 'Database branch name of your TigrisDB instance',
		default: nconf.get('tigris:branch') || 'main',
		ask: isUriNotSpecified,
	},
];

tigrisModule.init = async function () {
	client = await connection.connect(nconf.get('tigris'));
	tigrisModule.client = client.getDatabase();
};

tigrisModule.createSessionStore = async function (options) {
	const TigrisStore = require('./tigris/TigrisStore').default;
	const meta = require('../meta');
	const store = TigrisStore.create({
		clientPromise: connection.connect(options),
		ttl: meta.getSessionTTLSeconds(),
	});

	return store;
};

tigrisModule.createIndices = async function () {
	await tigrisModule.createSchema();
	if (!tigrisModule.client) {
		winston.warn('[database/createIndices] database not initialized');
		return;
	}

	// TODO - No longer needed, this is handled in TigrisDB core schema.
	winston.info('[database] Checking database indices.');
	// const collection = tigrisModule.client.collection('objects');
	// await collection.createIndex({ _key: 1, score: -1 }, { background: true });
	// await collection.createIndex({ _key: 1, value: -1 }, { background: true, unique: true, sparse: true });
	// await collection.createIndex({ expireAt: 1 }, { expireAfterSeconds: 0, background: true });
	winston.info('[database] Checking database indices done!');
};

tigrisModule.createSchema = async function () {
	// Schema can be added directly using TigrisDB core.
	const schema = {
		schema: require('./tigris/schema').schemaObject,
	};

	winston.info('[database] Creating objects schema.');

	const request = require('request-promise-native');

	await request({
		uri: 'https://api.preview.tigrisdata.cloud/v1/auth/token',
		method: 'POST',
		headers: {
			'Content-Type': 'application/x-www-form-urlencoded',
		},
		form: {
			grant_type: 'client_credentials',
			client_id: nconf.get('tigris').clientid,
			client_secret: nconf.get('tigris').clientsecret,
		},
		json: true,
	})
		.then((response) => {
			if (response.access_token) {
				return request({
					uri: `https://api.preview.tigrisdata.cloud/v1/projects/${nconf.get('tigris').database}/database/collections/objects/createOrUpdate`,
					method: 'POST',
					headers: {
						Authorization: `Bearer ${response.access_token}`,
						'Content-Type': 'application/json',
					},
					body: JSON.stringify(schema),
				})
					.then((response) => {
						console.log('response: ', response);
					})
					.catch((err) => {
						console.error('Error: ', err.message);
					});
			}
		}).catch(() => {
			console.error('Error: unable to create schema: ');
		});
};

tigrisModule.checkCompatibility = function (callback) {
	const mongoPkg = require('@tigrisdata/core/package.json');
	tigrisModule.checkCompatibilityVersion(mongoPkg.version, callback);
};

tigrisModule.checkCompatibilityVersion = function (version, callback) {
	if (semver.lt(version, '1.2.0')) {
		return callback(new Error('The `@tigrisdata/core` package is out-of-date, please run `./nodebb setup` again.'));
	}

	callback();
};

tigrisModule.info = async function (db) {
	// TODO - Tigris Core does not support this yet.
	return {};
	// if (!db) {
	// 	const client = await connection.connect(nconf.get('tigris'));
	// 	db = client.getDatabase();
	// }
	// tigrisModule.client = tigrisModule.client || db;
	// let serverStatusError = '';

	// async function getServerStatus() {
	// 	try {
	// 		return await db.command({ serverStatus: 1 });
	// 	} catch (err) {
	// 		serverStatusError = err.message;
	// 		// Override mongo error with more human-readable error
	// 		if (err.name === 'MongoError' && err.codeName === 'Unauthorized') {
	// 			// todo: confirm this doesn't have a translation.
	// 			serverStatusError = '[[admin/advanced/database:mongo.unauthorized]]';
	// 		}
	// 		winston.error(err.stack);
	// 	}
	// }

	// let [serverStatus, stats, listCollections] = await Promise.all([
	// 	getServerStatus(),
	// 	db.command({ dbStats: 1 }),
	// 	getCollectionStats(db),
	// ]);
	// stats = stats || {};
	// serverStatus = serverStatus || {};
	// stats.serverStatusError = serverStatusError;
	// const scale = 1024 * 1024 * 1024;

	// listCollections = listCollections.map(collectionInfo => ({
	// 	name: collectionInfo.ns,
	// 	count: collectionInfo.count,
	// 	size: collectionInfo.size,
	// 	avgObjSize: collectionInfo.avgObjSize,
	// 	storageSize: collectionInfo.storageSize,
	// 	totalIndexSize: collectionInfo.totalIndexSize,
	// 	indexSizes: collectionInfo.indexSizes,
	// }));

	// stats.mem = serverStatus.mem || { resident: 0, virtual: 0, mapped: 0 };
	// stats.mem.resident = (stats.mem.resident / 1024).toFixed(3);
	// stats.mem.virtual = (stats.mem.virtual / 1024).toFixed(3);
	// stats.mem.mapped = (stats.mem.mapped / 1024).toFixed(3);
	// stats.collectionData = listCollections;
	// stats.network = serverStatus.network || { bytesIn: 0, bytesOut: 0, numRequests: 0 };
	// stats.network.bytesIn = (stats.network.bytesIn / scale).toFixed(3);
	// stats.network.bytesOut = (stats.network.bytesOut / scale).toFixed(3);
	// stats.network.numRequests = utils.addCommas(stats.network.numRequests);
	// stats.raw = JSON.stringify(stats, null, 4);

	// stats.avgObjSize = stats.avgObjSize.toFixed(2);
	// stats.dataSize = (stats.dataSize / scale).toFixed(3);
	// stats.storageSize = (stats.storageSize / scale).toFixed(3);
	// stats.fileSize = stats.fileSize ? (stats.fileSize / scale).toFixed(3) : 0;
	// stats.indexSize = (stats.indexSize / scale).toFixed(3);
	// stats.storageEngine = serverStatus.storageEngine ? serverStatus.storageEngine.name : 'mmapv1';
	// stats.host = serverStatus.host;
	// stats.version = serverStatus.version;
	// stats.uptime = serverStatus.uptime;
	// stats.mongo = true; // todo: remove this later once confirmed.
	// stats.tigris = true;
	// return stats;
};

// async function getCollectionStats(db) {
// 	// TODO - Tigris Core does not support this yet.
// 	const items = await db.listCollections().toArray();
// 	return await Promise.all(items.map(collection => db.collection(collection.name).stats()));
// }

tigrisModule.close = async function () {
	await client.close();
};

require('./tigris/main')(tigrisModule);
require('./tigris/hash')(tigrisModule);
require('./tigris/sets')(tigrisModule);
require('./tigris/sorted')(tigrisModule);
require('./tigris/list')(tigrisModule);
require('./tigris/transaction')(tigrisModule);

// TODO - Check what this is doing.
require('../promisify')(tigrisModule, ['client', 'sessionStore']);
