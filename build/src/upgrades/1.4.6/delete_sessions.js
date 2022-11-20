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
const database_1 = __importDefault(require("../../database"));
const batch = require('../../batch');
exports.default = {
    name: 'Delete accidentally long-lived sessions',
    timestamp: Date.UTC(2017, 3, 16),
    method: function () {
        return __awaiter(this, void 0, void 0, function* () {
            let configJSON;
            try {
                configJSON = require('../../../config.json') || { [process.env.database]: true };
            }
            catch (err) {
                configJSON = { [process.env.database]: true };
            }
            const isRedisSessionStore = configJSON.hasOwnProperty('redis');
            const { progress } = this;
            if (isRedisSessionStore) {
                const connection = require('../../database/redis/connection');
                const client = yield connection.connect(nconf_1.default.get('redis'));
                const sessionKeys = yield client.keys('sess:*');
                progress.total = sessionKeys.length;
                yield batch.processArray(sessionKeys, (keys) => __awaiter(this, void 0, void 0, function* () {
                    const multi = client.multi();
                    keys.forEach((key) => {
                        progress.incr();
                        multi.del(key);
                    });
                    yield multi.exec();
                }), {
                    batch: 1000,
                });
            }
            else if (database_1.default.client && database_1.default.client.collection) {
                yield database_1.default.client.collection('sessions').deleteMany({}, {});
            }
        });
    },
};
