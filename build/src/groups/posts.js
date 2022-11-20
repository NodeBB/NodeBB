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
const database_1 = __importDefault(require("../database"));
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
            yield database_1.default.sortedSetsAdd(keys, postData.timestamp, postData.pid);
            yield Promise.all(groupNames.map(name => truncateMemberPosts(name)));
        });
    };
    function truncateMemberPosts(groupName) {
        return __awaiter(this, void 0, void 0, function* () {
            let lastPid = yield database_1.default.getSortedSetRevRange(`group:${groupName}:member:pids`, 10, 10);
            lastPid = lastPid[0];
            if (!parseInt(lastPid, 10)) {
                return;
            }
            const score = yield database_1.default.sortedSetScore(`group:${groupName}:member:pids`, lastPid);
            yield database_1.default.sortedSetsRemoveRangeByScore([`group:${groupName}:member:pids`], '-inf', score);
        });
    }
    Groups.getLatestMemberPosts = function (groupName, max, uid) {
        return __awaiter(this, void 0, void 0, function* () {
            let pids = yield database_1.default.getSortedSetRevRange(`group:${groupName}:member:pids`, 0, max - 1);
            pids = yield privileges.posts.filter('topics:read', pids, uid);
            return yield posts.getPostSummaryByPids(pids, uid, { stripTags: false });
        });
    };
}
exports.default = default_1;
;
