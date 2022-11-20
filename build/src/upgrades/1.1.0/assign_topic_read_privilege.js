/* eslint-disable no-await-in-loop */
'use strict';
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
const winston_1 = __importDefault(require("winston"));
const database_1 = __importDefault(require("../../database"));
exports.default = {
    name: 'Giving topics:read privs to any group/user that was previously allowed to Find & Access Category',
    timestamp: Date.UTC(2016, 4, 28),
    method: function () {
        return __awaiter(this, void 0, void 0, function* () {
            const groupsAPI = require('../../groups');
            const privilegesAPI = require('../../privileges');
            const cids = yield database_1.default.getSortedSetRange('categories:cid', 0, -1);
            for (const cid of cids) {
                const { groups, users } = yield privilegesAPI.categories.list(cid);
                for (const group of groups) {
                    if (group.privileges['groups:read']) {
                        yield groupsAPI.join(`cid:${cid}:privileges:groups:topics:read`, group.name);
                        winston_1.default.verbose(`cid:${cid}:privileges:groups:topics:read granted to gid: ${group.name}`);
                    }
                }
                for (const user of users) {
                    if (user.privileges.read) {
                        yield groupsAPI.join(`cid:${cid}:privileges:topics:read`, user.uid);
                        winston_1.default.verbose(`cid:${cid}:privileges:topics:read granted to uid: ${user.uid}`);
                    }
                }
                winston_1.default.verbose(`-- cid ${cid} upgraded`);
            }
        });
    },
};
