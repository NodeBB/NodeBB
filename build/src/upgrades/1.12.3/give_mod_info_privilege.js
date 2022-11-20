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
const database_1 = __importDefault(require("../../database"));
const privileges = require('../../privileges');
const groups = require('../../groups');
exports.default = {
    name: 'give mod info privilege',
    timestamp: Date.UTC(2019, 9, 8),
    method: function () {
        return __awaiter(this, void 0, void 0, function* () {
            const cids = yield database_1.default.getSortedSetRevRange('categories:cid', 0, -1);
            for (const cid of cids) {
                yield givePrivsToModerators(cid, '');
                yield givePrivsToModerators(cid, 'groups:');
            }
            yield privileges.global.give(['groups:view:users:info'], 'Global Moderators');
            function givePrivsToModerators(cid, groupPrefix) {
                return __awaiter(this, void 0, void 0, function* () {
                    const members = yield database_1.default.getSortedSetRevRange(`group:cid:${cid}:privileges:${groupPrefix}moderate:members`, 0, -1);
                    for (const member of members) {
                        yield groups.join(['cid:0:privileges:view:users:info'], member);
                    }
                });
            }
        });
    },
};
