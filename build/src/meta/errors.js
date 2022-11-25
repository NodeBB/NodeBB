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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const winston_1 = __importDefault(require("winston"));
const validator = require('validator');
const cronJob = require('cron').CronJob;
const database = __importStar(require("../database"));
const db = database;
const analytics = require('../analytics');
const Errors = {};
let counters = {};
new cronJob('0 * * * * *', (() => {
    Errors.writeData();
}), null, true);
Errors.writeData = function () {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const _counters = Object.assign({}, counters);
            counters = {};
            const keys = Object.keys(_counters);
            if (!keys.length) {
                return;
            }
            for (const key of keys) {
                /* eslint-disable no-await-in-loop */
                yield db.sortedSetIncrBy('errors:404', _counters[key], key);
            }
        }
        catch (err) {
            winston_1.default.error(err.stack);
        }
    });
};
Errors.log404 = function (route) {
    if (!route) {
        return;
    }
    route = route.slice(0, 512).replace(/\/$/, ''); // remove trailing slashes
    analytics.increment('errors:404');
    counters[route] = counters[route] || 0;
    counters[route] += 1;
};
Errors.get = function (escape) {
    return __awaiter(this, void 0, void 0, function* () {
        const data = yield db.getSortedSetRevRangeWithScores('errors:404', 0, 199);
        data.forEach((nfObject) => {
            nfObject.value = escape ? validator.escape(String(nfObject.value || '')) : nfObject.value;
        });
        return data;
    });
};
Errors.clear = function () {
    return __awaiter(this, void 0, void 0, function* () {
        yield db.delete('errors:404');
    });
};
exports.default = Errors;
