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
const privileges = require('../../privileges');
const groups = require('../../groups');
const database_1 = __importDefault(require("../../database"));
exports.default = {
    name: 'Give mods explicit privileges',
    timestamp: Date.UTC(2019, 4, 28),
    method: function () {
        return __awaiter(this, void 0, void 0, function* () {
            const defaultPrivileges = [
                'find',
                'read',
                'topics:read',
                'topics:create',
                'topics:reply',
                'topics:tag',
                'posts:edit',
                'posts:history',
                'posts:delete',
                'posts:upvote',
                'posts:downvote',
                'topics:delete',
            ];
            const modPrivileges = defaultPrivileges.concat([
                'posts:view_deleted',
                'purge',
            ]);
            const globalModPrivs = [
                'groups:chat',
                'groups:upload:post:image',
                'groups:upload:post:file',
                'groups:signature',
                'groups:ban',
                'groups:search:content',
                'groups:search:users',
                'groups:search:tags',
                'groups:view:users',
                'groups:view:tags',
                'groups:view:groups',
                'groups:local:login',
            ];
            const cids = yield database_1.default.getSortedSetRevRange('categories:cid', 0, -1);
            for (const cid of cids) {
                yield givePrivsToModerators(cid, '');
                yield givePrivsToModerators(cid, 'groups:');
                yield privileges.categories.give(modPrivileges.map(p => `groups:${p}`), cid, ['Global Moderators']);
            }
            yield privileges.global.give(globalModPrivs, 'Global Moderators');
            function givePrivsToModerators(cid, groupPrefix) {
                return __awaiter(this, void 0, void 0, function* () {
                    const privGroups = modPrivileges.map(priv => `cid:${cid}:privileges:${groupPrefix}${priv}`);
                    const members = yield database_1.default.getSortedSetRevRange(`group:cid:${cid}:privileges:${groupPrefix}moderate:members`, 0, -1);
                    for (const member of members) {
                        yield groups.join(privGroups, member);
                    }
                });
            }
        });
    },
};
