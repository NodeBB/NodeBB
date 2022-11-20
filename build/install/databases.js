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
const prompt = require('prompt');
const winston_1 = __importDefault(require("winston"));
const questions = {
    redis: require('../src/database/redis').default.questions,
    mongo: require('../src/database/mongo').default.questions,
    postgres: require('../src/database/postgres').default.questions,
};
module.exports = function (config) {
    return __awaiter(this, void 0, void 0, function* () {
        winston_1.default.info(`\nNow configuring ${config.database} database:`);
        const databaseConfig = yield getDatabaseConfig(config);
        return saveDatabaseConfig(config, databaseConfig);
    });
};
function getDatabaseConfig(config) {
    return __awaiter(this, void 0, void 0, function* () {
        if (!config) {
            throw new Error('invalid config, aborted');
        }
        if (config.database === 'redis') {
            if (config['redis:host'] && config['redis:port']) {
                return config;
            }
            return yield prompt.get(questions.redis);
        }
        else if (config.database === 'mongo') {
            if ((config['mongo:host'] && config['mongo:port']) || config['mongo:uri']) {
                return config;
            }
            return yield prompt.get(questions.mongo);
        }
        else if (config.database === 'postgres') {
            if (config['postgres:host'] && config['postgres:port']) {
                return config;
            }
            return yield prompt.get(questions.postgres);
        }
        throw new Error(`unknown database : ${config.database}`);
    });
}
function saveDatabaseConfig(config, databaseConfig) {
    if (!databaseConfig) {
        throw new Error('invalid config, aborted');
    }
    // Translate redis properties into redis object
    if (config.database === 'redis') {
        config.redis = {
            host: databaseConfig['redis:host'],
            port: databaseConfig['redis:port'],
            password: databaseConfig['redis:password'],
            database: databaseConfig['redis:database'],
        };
        if (config.redis.host.slice(0, 1) === '/') {
            delete config.redis.port;
        }
    }
    else if (config.database === 'mongo') {
        config.mongo = {
            host: databaseConfig['mongo:host'],
            port: databaseConfig['mongo:port'],
            username: databaseConfig['mongo:username'],
            password: databaseConfig['mongo:password'],
            database: databaseConfig['mongo:database'],
            uri: databaseConfig['mongo:uri'],
        };
    }
    else if (config.database === 'postgres') {
        config.postgres = {
            host: databaseConfig['postgres:host'],
            port: databaseConfig['postgres:port'],
            username: databaseConfig['postgres:username'],
            password: databaseConfig['postgres:password'],
            database: databaseConfig['postgres:database'],
            ssl: databaseConfig['postgres:ssl'],
        };
    }
    else {
        throw new Error(`unknown database : ${config.database}`);
    }
    const allQuestions = questions.redis.concat(questions.mongo).concat(questions.postgres);
    for (let x = 0; x < allQuestions.length; x += 1) {
        delete config[allQuestions[x].name];
    }
    return config;
}
