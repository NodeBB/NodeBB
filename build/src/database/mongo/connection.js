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
const nconf_1 = __importDefault(require("nconf"));
const winston_1 = __importDefault(require("winston"));
const _ = require('lodash');
const connection = {};
connection.getConnectionString = function (mongo) {
    mongo = mongo || nconf_1.default.get('mongo');
    let usernamePassword = '';
    const uri = mongo.uri || '';
    if (mongo.username && mongo.password) {
        usernamePassword = `${mongo.username}:${encodeURIComponent(mongo.password)}@`;
    }
    else if (!uri.includes('@') || !uri.slice(uri.indexOf('://') + 3, uri.indexOf('@'))) {
        winston_1.default.warn('You have no mongo username/password setup!');
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
        winston_1.default.warn('You have no database name, using "nodebb"');
        mongo.database = 'nodebb';
    }
    const hosts = mongo.host.split(',');
    const ports = mongo.port.toString().split(',');
    const servers = [];
    for (let i = 0; i < hosts.length; i += 1) {
        servers.push(`${hosts[i]}:${ports[i]}`);
    }
    return uri || `mongodb://${usernamePassword}${servers.join()}/${mongo.database}`;
};
connection.getConnectionOptions = function (mongo) {
    mongo = mongo || nconf_1.default.get('mongo');
    const connOptions = {
        maxPoolSize: 10,
        minPoolSize: 3,
        connectTimeoutMS: 90000,
    };
    return _.merge(connOptions, mongo.options || {});
};
connection.connect = function (options) {
    return __awaiter(this, void 0, void 0, function* () {
        const mongoClient = require('mongodb').MongoClient;
        const connString = connection.getConnectionString(options);
        const connOptions = connection.getConnectionOptions(options);
        return yield mongoClient.connect(connString, connOptions);
    });
};
exports.default = connection;
