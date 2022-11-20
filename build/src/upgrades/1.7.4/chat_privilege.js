'use strict';
Object.defineProperty(exports, "__esModule", { value: true });
const groups = require('../../groups');
exports.default = {
    name: 'Give chat privilege to registered-users',
    timestamp: Date.UTC(2017, 11, 18),
    method: function (callback) {
        groups.join('cid:0:privileges:groups:chat', 'registered-users', callback);
    },
};
