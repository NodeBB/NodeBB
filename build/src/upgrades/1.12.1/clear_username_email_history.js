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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const async = require('async');
const database = __importStar(require("../../database"));
const db = database;
const user_1 = __importDefault(require("../../user"));
exports.default = {
    name: 'Delete username email history for deleted users',
    timestamp: Date.UTC(2019, 2, 25),
    method: function (callback) {
        const { progress } = this;
        let currentUid = 1;
        db.getObjectField('global', 'nextUid', (err, nextUid) => {
            if (err) {
                return callback(err);
            }
            progress.total = nextUid;
            async.whilst((next) => {
                next(null, currentUid < nextUid);
            }, (next) => {
                progress.incr();
                user_1.default.exists(currentUid, (err, exists) => {
                    if (err) {
                        return next(err);
                    }
                    if (exists) {
                        currentUid += 1;
                        return next();
                    }
                    db.deleteAll([`user:${currentUid}:usernames`, `user:${currentUid}:emails`], (err) => {
                        if (err) {
                            return next(err);
                        }
                        currentUid += 1;
                        next();
                    });
                });
            }, (err) => {
                callback(err);
            });
        });
    },
};
