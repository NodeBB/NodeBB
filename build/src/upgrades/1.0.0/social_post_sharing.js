'use strict';
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const async = require('async');
const database_1 = __importDefault(require("../../database"));
exports.default = {
    name: 'Social: Post Sharing',
    timestamp: Date.UTC(2016, 1, 25),
    method: function (callback) {
        const social = require('../../social');
        async.parallel([
            function (next) {
                social.setActivePostSharingNetworks(['facebook', 'google', 'twitter'], next);
            },
            function (next) {
                database_1.default.deleteObjectField('config', 'disableSocialButtons', next);
            },
        ], callback);
    },
};
