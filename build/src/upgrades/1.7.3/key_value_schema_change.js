/* eslint-disable no-await-in-loop */
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
const database_1 = __importDefault(require("../../database"));
exports.default = {
    name: 'Change the schema of simple keys so they don\'t use value field (mongodb only)',
    timestamp: Date.UTC(2017, 11, 18),
    method: function () {
        return __awaiter(this, void 0, void 0, function* () {
            let configJSON;
            try {
                configJSON = require('../../../config.json') || { [process.env.database]: true, database: process.env.database };
            }
            catch (err) {
                configJSON = { [process.env.database]: true, database: process.env.database };
            }
            const isMongo = configJSON.hasOwnProperty('mongo') && configJSON.database === 'mongo';
            const { progress } = this;
            if (!isMongo) {
                return;
            }
            const { client } = database_1.default;
            const query = {
                _key: { $exists: true },
                value: { $exists: true },
                score: { $exists: false },
            };
            progress.total = yield client.collection('objects').countDocuments(query);
            const cursor = yield client.collection('objects').find(query).batchSize(1000);
            let done = false;
            while (!done) {
                const item = yield cursor.next();
                progress.incr();
                if (item === null) {
                    done = true;
                }
                else {
                    delete item.expireAt;
                    if (Object.keys(item).length === 3 && item.hasOwnProperty('_key') && item.hasOwnProperty('value')) {
                        yield client.collection('objects').updateOne({ _key: item._key }, { $rename: { value: 'data' } });
                    }
                }
            }
        });
    },
};
