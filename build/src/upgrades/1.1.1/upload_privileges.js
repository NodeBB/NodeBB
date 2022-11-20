'use strict';
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const async = require('async');
const database_1 = __importDefault(require("../../database"));
const meta_1 = __importDefault(require("../../meta"));
exports.default = {
    name: 'Giving upload privileges',
    timestamp: Date.UTC(2016, 6, 12),
    method: function (callback) {
        const privilegesAPI = require('../../privileges');
        database_1.default.getSortedSetRange('categories:cid', 0, -1, (err, cids) => {
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
