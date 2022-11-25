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
exports.primaryDB = void 0;
const nconf_1 = __importDefault(require("nconf"));
nconf_1.default.set('database', 'mongo');
const databaseName = nconf_1.default.get('database');
const winston_1 = __importDefault(require("winston"));
if (!databaseName) {
    winston_1.default.error(new Error('Database type not set! Run ./nodebb setup'));
    process.exit();
}
const primaryDB = require(`./${databaseName}`);
exports.primaryDB = primaryDB;
primaryDB.parseIntFields = function (data, intFields, requestedFields) {
    intFields.forEach((field) => {
        if (!requestedFields || !requestedFields.length || requestedFields.includes(field)) {
            data[field] = parseInt(data[field], 10) || 0;
        }
    });
};
primaryDB.initSessionStore = function () {
    return __awaiter(this, void 0, void 0, function* () {
        const sessionStoreConfig = nconf_1.default.get('session_store') || nconf_1.default.get('redis') || nconf_1.default.get(databaseName);
        let sessionStoreDB = primaryDB;
        if (nconf_1.default.get('session_store')) {
            sessionStoreDB = require(`./${sessionStoreConfig.name}`);
        }
        else if (nconf_1.default.get('redis')) {
            // if redis is specified, use it as session store over others
            sessionStoreDB = require('./redis');
        }
        primaryDB.sessionStore = yield sessionStoreDB.createSessionStore(sessionStoreConfig);
    });
};
