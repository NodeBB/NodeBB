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
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const fs = __importStar(require("fs"));
const path_1 = __importDefault(require("path"));
const winston_1 = __importDefault(require("winston"));
const validator = require('validator');
const { baseDir } = require('../constants').paths;
const database = __importStar(require("../database"));
const db = database;
const plugins = require('../plugins');
const batch = require('../batch');
function default_1(User) {
    User.logIP = function (uid, ip) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!(parseInt(uid, 10) > 0)) {
                return;
            }
            const now = Date.now();
            const bulk = [
                [`uid:${uid}:ip`, now, ip || 'Unknown'],
            ];
            if (ip) {
                bulk.push([`ip:${ip}:uid`, now, uid]);
            }
            yield db.sortedSetAddBulk(bulk);
        });
    };
    User.getIPs = function (uid, stop) {
        return __awaiter(this, void 0, void 0, function* () {
            const ips = yield db.getSortedSetRevRange(`uid:${uid}:ip`, 0, stop);
            return ips.map((ip) => validator.escape(String(ip)));
        });
    };
    User.getUsersCSV = function () {
        return __awaiter(this, void 0, void 0, function* () {
            winston_1.default.verbose('[user/getUsersCSV] Compiling User CSV data');
            const data = yield plugins.hooks.fire('filter:user.csvFields', { fields: ['uid', 'email', 'username'] });
            let csvContent = `${data.fields.join(',')}\n`;
            yield batch.processSortedSet('users:joindate', (uids) => __awaiter(this, void 0, void 0, function* () {
                const usersData = yield User.getUsersFields(uids, data.fields);
                csvContent += usersData.reduce((memo, user) => {
                    memo += `${data.fields.map((field) => user[field]).join(',')}\n`;
                    return memo;
                }, '');
            }), {});
            return csvContent;
        });
    };
    User.exportUsersCSV = function () {
        return __awaiter(this, void 0, void 0, function* () {
            winston_1.default.verbose('[user/exportUsersCSV] Exporting User CSV data');
            const { fields, showIps } = yield plugins.hooks.fire('filter:user.csvFields', {
                fields: ['email', 'username', 'uid'],
                showIps: true,
            });
            const fd = yield fs.promises.open(path_1.default.join(baseDir, 'build/export', 'users.csv'), 'w');
            fs.promises.appendFile(fd, `${fields.join(',')}${showIps ? ',ip' : ''}\n`);
            yield batch.processSortedSet('users:joindate', (uids) => __awaiter(this, void 0, void 0, function* () {
                const usersData = yield User.getUsersFields(uids, fields.slice());
                let userIPs = '';
                let ips = [];
                if (showIps) {
                    ips = yield db.getSortedSetsMembers(uids.map(uid => `uid:${uid}:ip`));
                }
                let line = '';
                usersData.forEach((user, index) => {
                    line += `${fields.map((field) => user[field]).join(',')}`;
                    if (showIps) {
                        userIPs = ips[index] ? ips[index].join(',') : '';
                        line += `,"${userIPs}"\n`;
                    }
                    else {
                        line += '\n';
                    }
                });
                yield fs.promises.appendFile(fd, line);
            }), {
                batch: 5000,
                interval: 250,
            });
            yield fd.close();
        });
    };
}
exports.default = default_1;
;
