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
const database = __importStar(require("../database"));
const db = database;
const groups = require('.');
const privileges = require('../privileges');
const posts = require('../posts');
function default_1(Groups) {
    Groups.onNewPostMade = function (postData) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!parseInt(postData.uid, 10)) {
                return;
            }
            let groupNames = yield Groups.getUserGroupMembership('groups:visible:createtime', [postData.uid]);
            groupNames = groupNames[0];
            // Only process those groups that have the cid in its memberPostCids setting (or no setting at all)
            const groupData = yield groups.getGroupsFields(groupNames, ['memberPostCids']);
            groupNames = groupNames.filter((groupName, idx) => (!groupData[idx].memberPostCidsArray.length ||
                groupData[idx].memberPostCidsArray.includes(postData.cid)));
            const keys = groupNames.map(groupName => `group:${groupName}:member:pids`);
            yield db.sortedSetsAdd(keys, postData.timestamp, postData.pid);
            yield Promise.all(groupNames.map(name => truncateMemberPosts(name)));
        });
    };
    function truncateMemberPosts(groupName) {
        return __awaiter(this, void 0, void 0, function* () {
            let lastPid = yield db.getSortedSetRevRange(`group:${groupName}:member:pids`, 10, 10);
            lastPid = lastPid[0];
            if (!parseInt(lastPid, 10)) {
                return;
            }
            const score = yield db.sortedSetScore(`group:${groupName}:member:pids`, lastPid);
            yield db.sortedSetsRemoveRangeByScore([`group:${groupName}:member:pids`], '-inf', score);
        });
    }
    Groups.getLatestMemberPosts = function (groupName, max, uid) {
        return __awaiter(this, void 0, void 0, function* () {
            let pids = yield db.getSortedSetRevRange(`group:${groupName}:member:pids`, 0, max - 1);
            pids = yield privileges.posts.filter('topics:read', pids, uid);
            return yield posts.getPostSummaryByPids(pids, uid, { stripTags: false });
        });
    };
}
exports.default = default_1;
;
