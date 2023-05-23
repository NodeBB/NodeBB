
'use strict';


const winston = require('winston');
const nconf = require('nconf');
const semver = require('semver');
const prompt = require('prompt');
const utils = require('../utils');

let client;

const connection = require('./tigriscomp/connection');

const tigriscompModule = module.exports;

function isUriNotSpecified() {
	return !prompt.history('tigriscomp:uri').value;
}

tigriscompModule.questions = [
	{
		name: 'tigriscomp:uri',
		description: 'TigrisDB connection URI: (leave blank if you wish to specify host, port, clientID/clientSecret and database individually)\nFormat: mongodb://[clientId:clientSecret@]host1[:port1][,host2[:port2],...[,hostN[:portN]]][/[database][?options]]',
		default: nconf.get('tigriscomp:uri') || '',
		hideOnWebInstall: true,
	},
	{
		name: 'tigriscomp:host',
		description: 'Host IP or address of your tigrisDB instance',
		default: nconf.get('tigriscomp:host') || 'm1k.preview.tigrisdata.cloud',
		ask: isUriNotSpecified,
	},
	{
		name: 'tigriscomp:port',
		description: 'Host port of your TigrisDB instance',
		default: nconf.get('tigriscomp:port') || 27018,
		ask: isUriNotSpecified,
	},
	{
		name: 'tigriscomp:clientid',
		description: 'TigrisDB Client ID',
		default: nconf.get('tigriscomp:clientid') || '',
		ask: isUriNotSpecified,
	},
	{
		name: 'tigriscomp:clientsecret',
		description: 'Client Secret of your TigrisDB database',
		default: nconf.get('tigriscomp:clientsecret') || '',
		hidden: true,
		ask: isUriNotSpecified,
		before: function (value) { value = value || nconf.get('tigriscomp:clientsecret') || ''; return value; },
	},
	{
		name: 'tigriscomp:database',
		description: 'TigrisDB database name',
		default: nconf.get('tigriscomp:database') || 'nodebb',
		ask: isUriNotSpecified,
	},
];

tigriscompModule.init = async function () {
	client = await connection.connect(nconf.get('tigriscomp'));
	const dbName = nconf.get('tigriscomp').database;
	tigriscompModule.client = client.db(dbName);
};

tigriscompModule.createSessionStore = async function (options) {
	const MongoStore = require('connect-mongo');
	const meta = require('../meta');

	const store = MongoStore.create({
		clientPromise: connection.connect(options),
		ttl: meta.getSessionTTLSeconds(),
	});

	return store;
};

tigriscompModule.createIndices = async function () {
	if (!tigriscompModule.client) {
		winston.warn('[database/createIndices] database not initialized');
		return;
	}

	winston.info('[database] Checking database indices.');
	const collection = tigriscompModule.client.collection('objects');
	await collection.createIndex({ _key: 1, score: -1 }, { background: true });
	await collection.createIndex({ _key: 1, value: -1 }, { background: true, unique: true, sparse: true });
	await collection.createIndex({ expireAt: 1 }, { expireAfterSeconds: 0, background: true });
	winston.info('[database] Checking database indices done!');
};

tigriscompModule.createSchema = async function () {
	// TODO: Remove this when using TigrisDB core, this is just a temporary solution.
	// Schema can be added directly using TigrisDB core.
	const schema = {
		schema: require('./tigriscomp/schema'),
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
			client_id: nconf.get('tigriscomp').clientid,
			client_secret: nconf.get('tigriscomp').clientsecret,
		},
		json: true,
	})
		.then((response) => {
			if (response.access_token) {
				return request({
					uri: `https://api.preview.tigrisdata.cloud/v1/projects/${nconf.get('tigriscomp').database}/database/collections/objects/createOrUpdate`,
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
						console.error('Error: ', err);
					});
			}
		}).catch((err) => {
			console.error('Error: ', err);
		});
};

tigriscompModule.checkCompatibility = function (callback) {
	const mongoPkg = require('mongodb/package.json');
	tigriscompModule.checkCompatibilityVersion(mongoPkg.version, callback);
};

tigriscompModule.checkCompatibilityVersion = function (version, callback) {
	if (semver.lt(version, '2.0.0')) {
		return callback(new Error('The `mongodb` package is out-of-date, please run `./nodebb setup` again.'));
	}

	callback();
};

tigriscompModule.info = async function (db) {
	if (!db) {
		const client = await connection.connect(nconf.get('tigriscomp'));
		db = client.db(nconf.get('tigriscomp').database);
	}
	tigriscompModule.client = tigriscompModule.client || db;
	let serverStatusError = '';

	async function getServerStatus() {
		try {
			return await db.command({ serverStatus: 1 });
		} catch (err) {
			serverStatusError = err.message;
			// Override mongo error with more human-readable error
			if (err.name === 'MongoError' && err.codeName === 'Unauthorized') {
				// todo: confirm this doesn't have a translation.
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
		size: collectionInfo.size,
		avgObjSize: collectionInfo.avgObjSize,
		storageSize: collectionInfo.storageSize,
		totalIndexSize: collectionInfo.totalIndexSize,
		indexSizes: collectionInfo.indexSizes,
	}));

	stats.mem = serverStatus.mem || { resident: 0, virtual: 0, mapped: 0 };
	stats.mem.resident = (stats.mem.resident / 1024).toFixed(3);
	stats.mem.virtual = (stats.mem.virtual / 1024).toFixed(3);
	stats.mem.mapped = (stats.mem.mapped / 1024).toFixed(3);
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
	stats.mongo = true; // todo: remove this later once confirmed.
	stats.tigriscomp = true;
	return stats;
};

async function getCollectionStats(db) {
	const items = await db.listCollections().toArray();
	return await Promise.all(items.map(collection => db.collection(collection.name).stats()));
}

tigriscompModule.close = async function () {
	await client.close();
};

require('./tigriscomp/main')(tigriscompModule);
require('./tigriscomp/hash')(tigriscompModule);
require('./tigriscomp/sets')(tigriscompModule);
require('./tigriscomp/sorted')(tigriscompModule);
require('./tigriscomp/list')(tigriscompModule);
require('./tigriscomp/transaction')(tigriscompModule);

require('../promisify')(tigriscompModule, ['client', 'sessionStore']);
