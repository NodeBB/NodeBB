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
const meta_1 = __importDefault(require("../../meta"));
exports.default = {
    name: 'Giving upload privileges',
    timestamp: Date.UTC(2016, 6, 12),
    method: function (callback) {
        const privilegesAPI = require('../../privileges');
        db.getSortedSetRange('categories:cid', 0, -1, (err, cids) => {
            if (err) {
                return callback(err);
            }
            async.eachSeries(cids, (cid, next) => {
                privilegesAPI.categories.list(cid, (err, data) => {
                    if (err) {
                        return next(err);
                    }
                    async.eachSeries(data.groups, (group, next) => {
                        if (group.name === 'guests' && parseInt(meta_1.default.config.allowGuestUploads, 10) !== 1) {
                            return next();
                        }
                        if (group.privileges['groups:read']) {
                            privilegesAPI.categories.give(['upload:post:image'], cid, group.name, next);
                        }
                        else {
                            next();
                        }
                    }, next);
                });
            }, callback);
        });
    },
};
