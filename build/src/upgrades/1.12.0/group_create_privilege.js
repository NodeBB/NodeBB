'use strict';
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const privileges = require('../../privileges');
const meta_1 = __importDefault(require("../../meta"));
exports.default = {
    name: 'Group create global privilege',
    timestamp: Date.UTC(2019, 0, 4),
    method: function (callback) {
        if (parseInt(meta_1.default.config.allowGroupCreation, 10) === 1) {
            privileges.global.give(['groups:group:create'], 'registered-users', callback);
        }
        else {
            setImmediate(callback);
        }
    },
};
