'use strict';
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const winston_1 = __importDefault(require("winston"));
const nconf_1 = __importDefault(require("nconf"));
const meta_1 = __importDefault(require("../meta"));
const semver = require('semver');
const prompt = require('prompt');
const utils = require('../utils');
let client;
const connection = require('./mongo/connection').default;
const mongoModule = {};
function isUriNotSpecified() {
    return !prompt.history('mongo:uri').value;
}
mongoModule.questions = [
    {
        name: 'mongo:uri',
        description: 'MongoDB connection URI: (leave blank if you wish to specify host, port, username/password and database individually)\nFormat: mongodb://[username:password@]host1[:port1][,host2[:port2],...[,hostN[:portN]]][/[database][?options]]',
        default: nconf_1.default.get('mongo:uri') || '',
        hideOnWebInstall: true,
    },
    {
        name: 'mongo:host',
        description: 'Host IP or address of your MongoDB instance',
        default: nconf_1.default.get('mongo:host') || '127.0.0.1',
        ask: isUriNotSpecified,
    },
    {
        name: 'mongo:port',
        description: 'Host port of your MongoDB instance',
        default: nconf_1.default.get('mongo:port') || 27017,
        ask: isUriNotSpecified,
    },
    {
        name: 'mongo:username',
        description: 'MongoDB username',
        default: nconf_1.default.get('mongo:username') || '',
        ask: isUriNotSpecified,
    },
    {
        name: 'mongo:password',
        description: 'Password of your MongoDB database',
        default: nconf_1.default.get('mongo:password') || '',
        hidden: true,
        ask: isUriNotSpecified,
        before: function (value) { value = value || nconf_1.default.get('mongo:password') || ''; return value; },
    },
    {
        name: 'mongo:database',
        description: 'MongoDB database name',
        default: nconf_1.default.get('mongo:database') || 'nodebb',
        ask: isUriNotSpecified,
    },
];
mongoModule.init = function () {
    return __awaiter(this, void 0, void 0, function* () {
        client = yield connection.connect(nconf_1.default.get('mongo'));
        mongoModule.client = client.db();
    });
};
mongoModule.createSessionStore = function (options) {
    return __awaiter(this, void 0, void 0, function* () {
        const MongoStore = require('connect-mongo');
        const store = MongoStore.create({
            clientPromise: connection.connect(options),
            ttl: meta_1.default.getSessionTTLSeconds(),
        });
        return store;
    });
};
mongoModule.createIndices = function () {
    return __awaiter(this, void 0, void 0, function* () {
        if (!mongoModule.client) {
            winston_1.default.warn('[database/createIndices] database not initialized');
            return;
        }
        winston_1.default.info('[database] Checking database indices.');
        const collection = mongoModule.client.collection('objects');
        yield collection.createIndex({ _key: 1, score: -1 }, { background: true });
        yield collection.createIndex({ _key: 1, value: -1 }, { background: true, unique: true, sparse: true });
        yield collection.createIndex({ expireAt: 1 }, { expireAfterSeconds: 0, background: true });
        winston_1.default.info('[database] Checking database indices done!');
    });
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
mongoModule.info = function (db) {
    return __awaiter(this, void 0, void 0, function* () {
        if (!db) {
            const client = yield connection.connect(nconf_1.default.get('mongo'));
            db = client.db();
        }
        mongoModule.client = mongoModule.client || db;
        let serverStatusError = '';
        function getServerStatus() {
            return __awaiter(this, void 0, void 0, function* () {
                try {
                    return yield db.command({ serverStatus: 1 });
                }
                catch (err) {
                    serverStatusError = err.message;
                    // Override mongo error with more human-readable error
                    if (err.name === 'MongoError' && err.codeName === 'Unauthorized') {
                        serverStatusError = '[[admin/advanced/database:mongo.unauthorized]]';
                    }
                    winston_1.default.error(err.stack);
                }
            });
        }
        let [serverStatus, stats, listCollections] = yield Promise.all([
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
        stats.mongo = true;
        return stats;
    });
};
function getCollectionStats(db) {
    return __awaiter(this, void 0, void 0, function* () {
        const items = yield db.listCollections().toArray();
        return yield Promise.all(items.map(collection => db.collection(collection.name).stats()));
    });
}
mongoModule.close = function (callback) {
    callback = callback || function () { };
    client.close(err => callback(err));
};
require('./mongo/main').default(mongoModule);
require('./mongo/hash').default(mongoModule);
require('./mongo/sets').default(mongoModule);
require('./mongo/sorted').default(mongoModule);
require('./mongo/list').default(mongoModule);
require('./mongo/transaction').default(mongoModule);
require('../promisify').promisify(mongoModule, ['client', 'sessionStore']);
console.log('MONGO MODULE', mongoModule);
exports.default = mongoModule;
