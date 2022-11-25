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
const nconf_1 = __importDefault(require("nconf"));
const validator = require('validator');
const database = __importStar(require("../../database"));
const db = database;
const user_1 = __importDefault(require("../../user"));
const groups = require('../../groups');
const meta_1 = __importDefault(require("../../meta"));
const pagination = require('../../pagination');
const events = require('../../events');
const slugify = require('../../slugify');
const groupsController = {};
groupsController.list = function (req, res) {
    return __awaiter(this, void 0, void 0, function* () {
        const page = parseInt(req.query.page, 10) || 1;
        const groupsPerPage = 20;
        let groupNames = yield getGroupNames();
        const pageCount = Math.ceil(groupNames.length / groupsPerPage);
        const start = (page - 1) * groupsPerPage;
        const stop = start + groupsPerPage - 1;
        groupNames = groupNames.slice(start, stop + 1);
        const groupData = yield groups.getGroupsData(groupNames);
        res.render('admin/manage/groups', {
            groups: groupData,
            pagination: pagination.create(page, pageCount),
            yourid: req.uid,
        });
    });
};
groupsController.get = function (req, res, next) {
    return __awaiter(this, void 0, void 0, function* () {
        const slug = slugify(req.params.name);
        const groupName = yield groups.getGroupNameByGroupSlug(slug);
        const [groupNames, group] = yield Promise.all([
            getGroupNames(),
            groups.get(groupName, { uid: req.uid, truncateUserList: true, userListCount: 20 }),
        ]);
        if (!group || groupName === groups.BANNED_USERS) {
            return next();
        }
        group.isOwner = true;
        const groupNameData = groupNames.map((name) => ({
            encodedName: encodeURIComponent(name),
            displayName: validator.escape(String(name)),
            selected: name === groupName,
        }));
        res.render('admin/manage/group', {
            group: group,
            groupNames: groupNameData,
            allowPrivateGroups: meta_1.default.config.allowPrivateGroups,
            maximumGroupNameLength: meta_1.default.config.maximumGroupNameLength,
            maximumGroupTitleLength: meta_1.default.config.maximumGroupTitleLength,
        });
    });
};
function getGroupNames() {
    return __awaiter(this, void 0, void 0, function* () {
        const groupNames = yield db.getSortedSetRange('groups:createtime', 0, -1);
        return groupNames.filter((name) => (name !== 'registered-users' &&
            name !== 'verified-users' &&
            name !== 'unverified-users' &&
            name !== groups.BANNED_USERS &&
            !groups.isPrivilegeGroup(name)));
    });
}
groupsController.getCSV = function (req, res) {
    return __awaiter(this, void 0, void 0, function* () {
        const { referer } = req.headers;
        if (!referer || !referer.replace(nconf_1.default.get('url'), '').startsWith('/admin/manage/groups')) {
            return res.status(403).send('[[error:invalid-origin]]');
        }
        yield events.log({
            type: 'getGroupCSV',
            uid: req.uid,
            ip: req.ip,
            group: req.params.groupname,
        });
        const groupName = req.params.groupname;
        const members = (yield groups.getMembersOfGroups([groupName]))[0];
        const fields = ['email', 'username', 'uid'];
        const userData = yield user_1.default.getUsersFields(members, fields);
        let csvContent = `${fields.join(',')}\n`;
        csvContent += userData.reduce((memo, user) => {
            memo += `${user.email},${user.username},${user.uid}\n`;
            return memo;
        }, '');
        res.attachment(`${validator.escape(groupName)}_members.csv`);
        res.setHeader('Content-Type', 'text/csv');
        res.end(csvContent);
    });
};
