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
const semver = require('semver');
const session = require('express-session');
const meta_1 = __importDefault(require("../meta"));
const connection = require('./redis/connection');
const redisModule = {};
redisModule.questions = [
    {
        name: 'redis:host',
        description: 'Host IP or address of your Redis instance',
        default: nconf_1.default.get('redis:host') || '127.0.0.1',
    },
    {
        name: 'redis:port',
        description: 'Host port of your Redis instance',
        default: nconf_1.default.get('redis:port') || 6379,
    },
    {
        name: 'redis:password',
        description: 'Password of your Redis database',
        hidden: true,
        default: nconf_1.default.get('redis:password') || '',
        before: function (value) { value = value || nconf_1.default.get('redis:password') || ''; return value; },
    },
    {
        name: 'redis:database',
        description: 'Which database to use (0..n)',
        default: nconf_1.default.get('redis:database') || 0,
    },
];
redisModule.init = function () {
    return __awaiter(this, void 0, void 0, function* () {
        redisModule.client = yield connection.connect(nconf_1.default.get('redis'));
    });
};
redisModule.createSessionStore = function (options) {
    return __awaiter(this, void 0, void 0, function* () {
        const sessionStore = require('connect-redis').default(session);
        const client = yield connection.connect(options);
        const store = new sessionStore({
            client: client,
            ttl: meta_1.default.getSessionTTLSeconds(),
        });
        return store;
    });
};
redisModule.checkCompatibility = function () {
    return __awaiter(this, void 0, void 0, function* () {
        const info = yield redisModule.info(redisModule.client);
        yield redisModule.checkCompatibilityVersion(info.redis_version);
    });
};
redisModule.checkCompatibilityVersion = function (version, callback) {
    if (semver.lt(version, '2.8.9')) {
        callback(new Error('Your Redis version is not new enough to support NodeBB, please upgrade Redis to v2.8.9 or higher.'));
    }
    callback();
};
redisModule.close = function () {
    return __awaiter(this, void 0, void 0, function* () {
        yield redisModule.client.quit();
    });
};
redisModule.info = function (cxn) {
    return __awaiter(this, void 0, void 0, function* () {
        if (!cxn) {
            cxn = yield connection.connect(nconf_1.default.get('redis'));
        }
        redisModule.client = redisModule.client || cxn;
        const data = yield cxn.info();
        const lines = data.toString().split('\r\n').sort();
        const redisData = {};
        lines.forEach((line) => {
            const parts = line.split(':');
            if (parts[1]) {
                redisData[parts[0]] = parts[1];
            }
        });
        const keyInfo = redisData[`db${nconf_1.default.get('redis:database')}`];
        if (keyInfo) {
            const split = keyInfo.split(',');
            redisData.keys = (split[0] || '').replace('keys=', '');
            redisData.expires = (split[1] || '').replace('expires=', '');
            redisData.avg_ttl = (split[2] || '').replace('avg_ttl=', '');
        }
        redisData.instantaneous_input = (redisData.instantaneous_input_kbps / 1024).toFixed(3);
        redisData.instantaneous_output = (redisData.instantaneous_output_kbps / 1024).toFixed(3);
        redisData.total_net_input = (redisData.total_net_input_bytes / (1024 * 1024 * 1024)).toFixed(3);
        redisData.total_net_output = (redisData.total_net_output_bytes / (1024 * 1024 * 1024)).toFixed(3);
        redisData.used_memory_human = (redisData.used_memory / (1024 * 1024 * 1024)).toFixed(3);
        redisData.raw = JSON.stringify(redisData, null, 4);
        redisData.redis = true;
        return redisData;
    });
};
redisModule.socketAdapter = function () {
    return __awaiter(this, void 0, void 0, function* () {
        const redisAdapter = require('@socket.io/redis-adapter');
        const pub = yield connection.connect(nconf_1.default.get('redis'));
        const sub = yield connection.connect(nconf_1.default.get('redis'));
        return redisAdapter(pub, sub, {
            key: `db:${nconf_1.default.get('redis:database')}:adapter_key`,
        });
    });
};
require('./redis/main').default(redisModule);
require('./redis/hash').default(redisModule);
require('./redis/sets').default(redisModule);
require('./redis/sorted').default(redisModule);
require('./redis/list').default(redisModule);
require('./redis/transaction').default(redisModule);
require('../promisify').promisify(redisModule, ['client', 'sessionStore']);
exports.default = redisModule;
