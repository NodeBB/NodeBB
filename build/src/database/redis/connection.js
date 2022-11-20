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
const Redis = require('ioredis');
const winston_1 = __importDefault(require("winston"));
const connection = {};
connection.connect = function (options) {
    return __awaiter(this, void 0, void 0, function* () {
        return new Promise((resolve, reject) => {
            options = options || nconf_1.default.get('redis');
            const redis_socket_or_host = options.host;
            let cxn;
            if (options.cluster) {
                cxn = new Redis.Cluster(options.cluster, options.options);
            }
            else if (options.sentinels) {
                cxn = new Redis(Object.assign({ sentinels: options.sentinels }, options.options));
            }
            else if (redis_socket_or_host && String(redis_socket_or_host).indexOf('/') >= 0) {
                // If redis.host contains a path name character, use the unix dom sock connection. ie, /tmp/redis.sock
                cxn = new Redis(Object.assign(Object.assign({}, options.options), { path: redis_socket_or_host, password: options.password, db: options.database }));
            }
            else {
                // Else, connect over tcp/ip
                cxn = new Redis(Object.assign(Object.assign({}, options.options), { host: redis_socket_or_host, port: options.port, password: options.password, db: options.database }));
            }
            const dbIdx = parseInt(options.database, 10);
            if (!(dbIdx >= 0)) {
                throw new Error('[[error:no-database-selected]]');
            }
            cxn.on('error', (err) => {
                winston_1.default.error(err.stack);
                reject(err);
            });
            cxn.on('ready', () => {
                // back-compat with node_redis
                cxn.batch = cxn.pipeline;
                resolve(cxn);
            });
            if (options.password) {
                cxn.auth(options.password);
            }
        });
    });
};
require('../../promisify').promisify(connection);
exports.default = connection;
