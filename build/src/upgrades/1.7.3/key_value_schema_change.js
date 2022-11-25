/* eslint-disable no-await-in-loop */
'use strict';
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
const database = __importStar(require("../../database"));
const db = database;
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
            const { client } = db;
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
