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
Object.defineProperty(exports, "__esModule", { value: true });
const async = require('async');
const groups = require('../../groups');
const privileges = require('../../privileges');
const database = __importStar(require("../../database"));
const db = database;
exports.default = {
    name: 'Give category access privileges to spiders system group',
    timestamp: Date.UTC(2018, 0, 31),
    method: function (callback) {
        db.getSortedSetRange('categories:cid', 0, -1, (err, cids) => {
            if (err) {
                return callback(err);
            }
            async.eachSeries(cids, (cid, next) => {
                getGroupPrivileges(cid, (err, groupPrivileges) => {
                    if (err) {
                        return next(err);
                    }
                    const privs = [];
                    if (groupPrivileges['groups:find']) {
                        privs.push('groups:find');
                    }
                    if (groupPrivileges['groups:read']) {
                        privs.push('groups:read');
                    }
                    if (groupPrivileges['groups:topics:read']) {
                        privs.push('groups:topics:read');
                    }
                    privileges.categories.give(privs, cid, 'spiders', next);
                });
            }, callback);
        });
    },
};
function getGroupPrivileges(cid, callback) {
    const tasks = {};
    ['groups:find', 'groups:read', 'groups:topics:read'].forEach((privilege) => {
        tasks[privilege] = async.apply(groups.isMember, 'guests', `cid:${cid}:privileges:${privilege}`);
    });
    async.parallel(tasks, callback);
}
