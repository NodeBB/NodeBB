'use strict';
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const async = require('async');
const winston_1 = __importDefault(require("winston"));
const database_1 = __importDefault(require("../../database"));
exports.default = {
    name: 'Removing best posts with negative scores',
    timestamp: Date.UTC(2016, 7, 5),
    method: function (callback) {
        const batch = require('../../batch');
        batch.processSortedSet('users:joindate', (ids, next) => {
            async.each(ids, (id, next) => {
                winston_1.default.verbose(`processing uid ${id}`);
                database_1.default.sortedSetsRemoveRangeByScore([`uid:${id}:posts:votes`], '-inf', 0, next);
            }, next);
        }, {}, callback);
    },
};
