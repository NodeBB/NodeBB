/* eslint-disable no-await-in-loop */
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
Object.defineProperty(exports, "__esModule", { value: true });
const privileges = require('../../privileges');
const groups = require('../../groups');
const database = __importStar(require("../../database"));
const db = database;
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
            const cids = yield db.getSortedSetRevRange('categories:cid', 0, -1);
            for (const cid of cids) {
                yield givePrivsToModerators(cid, '');
                yield givePrivsToModerators(cid, 'groups:');
                yield privileges.categories.give(modPrivileges.map(p => `groups:${p}`), cid, ['Global Moderators']);
            }
            yield privileges.global.give(globalModPrivs, 'Global Moderators');
            function givePrivsToModerators(cid, groupPrefix) {
                return __awaiter(this, void 0, void 0, function* () {
                    const privGroups = modPrivileges.map(priv => `cid:${cid}:privileges:${groupPrefix}${priv}`);
                    const members = yield db.getSortedSetRevRange(`group:cid:${cid}:privileges:${groupPrefix}moderate:members`, 0, -1);
                    for (const member of members) {
                        yield groups.join(privGroups, member);
                    }
                });
            }
        });
    },
};
