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
connection.getConnectionOptions = function (postgres) {
    postgres = postgres || nconf_1.default.get('postgres');
    // Sensible defaults for PostgreSQL, if not set
    if (!postgres.host) {
        postgres.host = '127.0.0.1';
    }
    if (!postgres.port) {
        postgres.port = 5432;
    }
    const dbName = postgres.database;
    if (dbName === undefined || dbName === '') {
        winston_1.default.warn('You have no database name, using "nodebb"');
        postgres.database = 'nodebb';
    }
    const connOptions = {
        host: postgres.host,
        port: postgres.port,
        user: postgres.username,
        password: postgres.password,
        database: postgres.database,
        ssl: String(postgres.ssl) === 'true',
    };
    return _.merge(connOptions, postgres.options || {});
};
connection.connect = function (options) {
    return __awaiter(this, void 0, void 0, function* () {
        const { Pool } = require('pg');
        const connOptions = connection.getConnectionOptions(options);
        const db = new Pool(connOptions);
        yield db.connect();
        return db;
    });
};
require('../../promisify').promisify(connection);
