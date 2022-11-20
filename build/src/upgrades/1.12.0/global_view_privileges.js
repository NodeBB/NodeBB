'use strict';
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const async = require('async');
const privileges = require('../../privileges');
const meta_1 = __importDefault(require("../../meta"));
exports.default = {
    name: 'Global view privileges',
    timestamp: Date.UTC(2019, 0, 5),
    method: function (callback) {
        const tasks = [
            async.apply(privileges.global.give, ['groups:view:users', 'groups:view:tags', 'groups:view:groups'], 'registered-users'),
        ];
        if (parseInt(meta_1.default.config.privateUserInfo, 10) !== 1) {
            tasks.push(async.apply(privileges.global.give, ['groups:view:users', 'groups:view:groups'], 'guests'));
            tasks.push(async.apply(privileges.global.give, ['groups:view:users', 'groups:view:groups'], 'spiders'));
        }
        if (parseInt(meta_1.default.config.privateTagListing, 10) !== 1) {
            tasks.push(async.apply(privileges.global.give, ['groups:view:tags'], 'guests'));
            tasks.push(async.apply(privileges.global.give, ['groups:view:tags'], 'spiders'));
        }
        async.series(tasks, callback);
    },
};
