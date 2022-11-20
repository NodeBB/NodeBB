'use strict';
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const meta_1 = __importDefault(require("../../meta"));
exports.default = {
    name: 'Give global local login privileges',
    timestamp: Date.UTC(2018, 8, 28),
    method: function (callback) {
        const privileges = require('../../privileges');
        const allowLocalLogin = parseInt(meta_1.default.config.allowLocalLogin, 10) !== 0;
        if (allowLocalLogin) {
            privileges.global.give(['groups:local:login'], 'registered-users', callback);
        }
        else {
            callback();
        }
    },
};
