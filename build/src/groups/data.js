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
const validator = require('validator');
const nconf_1 = __importDefault(require("nconf"));
const database = __importStar(require("../database"));
const db = database;
const plugins = require('../plugins');
const utils = require('../utils');
const translator = require('../translator');
const intFields = [
    'createtime', 'memberCount', 'hidden', 'system', 'private',
    'userTitleEnabled', 'disableJoinRequests', 'disableLeave',
];
function default_1(Groups) {
    Groups.getGroupsFields = function (groupNames, fields) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!Array.isArray(groupNames) || !groupNames.length) {
                return [];
            }
            const ephemeralIdx = groupNames.reduce((memo, cur, idx) => {
                if (Groups.ephemeralGroups.includes(cur)) {
                    memo.push(idx);
                }
                return memo;
            }, []);
            const keys = groupNames.map(groupName => `group:${groupName}`);
            const groupData = yield db.getObjects(keys, fields);
            if (ephemeralIdx.length) {
                ephemeralIdx.forEach((idx) => {
                    groupData[idx] = Groups.getEphemeralGroup(groupNames[idx]);
                });
            }
            groupData.forEach(group => modifyGroup(group, fields));
            const results = yield plugins.hooks.fire('filter:groups.get', { groups: groupData });
            return results.groups;
        });
    };
    Groups.getGroupsData = function (groupNames) {
        return __awaiter(this, void 0, void 0, function* () {
            return yield Groups.getGroupsFields(groupNames, []);
        });
    };
    Groups.getGroupData = function (groupName) {
        return __awaiter(this, void 0, void 0, function* () {
            const groupsData = yield Groups.getGroupsData([groupName]);
            return Array.isArray(groupsData) && groupsData[0] ? groupsData[0] : null;
        });
    };
    Groups.getGroupField = function (groupName, field) {
        return __awaiter(this, void 0, void 0, function* () {
            const groupData = yield Groups.getGroupFields(groupName, [field]);
            return groupData ? groupData[field] : null;
        });
    };
    Groups.getGroupFields = function (groupName, fields) {
        return __awaiter(this, void 0, void 0, function* () {
            const groups = yield Groups.getGroupsFields([groupName], fields);
            return groups ? groups[0] : null;
        });
    };
    Groups.setGroupField = function (groupName, field, value) {
        return __awaiter(this, void 0, void 0, function* () {
            yield db.setObjectField(`group:${groupName}`, field, value);
            plugins.hooks.fire('action:group.set', { field: field, value: value, type: 'set' });
        });
    };
}
exports.default = default_1;
;
function modifyGroup(group, fields) {
    if (group) {
        db.parseIntFields(group, intFields, fields);
        escapeGroupData(group);
        group.userTitleEnabled = ([null, undefined].includes(group.userTitleEnabled)) ? 1 : group.userTitleEnabled;
        group.labelColor = validator.escape(String(group.labelColor || '#000000'));
        group.textColor = validator.escape(String(group.textColor || '#ffffff'));
        group.icon = validator.escape(String(group.icon || ''));
        group.createtimeISO = utils.toISOString(group.createtime);
        group.private = ([null, undefined].includes(group.private)) ? 1 : group.private;
        group.memberPostCids = group.memberPostCids || '';
        group.memberPostCidsArray = group.memberPostCids.split(',').map((cid) => parseInt(cid, 10)).filter(Boolean);
        group['cover:thumb:url'] = group['cover:thumb:url'] || group['cover:url'];
        if (group['cover:url']) {
            group['cover:url'] = group['cover:url'].startsWith('http') ? group['cover:url'] : (nconf_1.default.get('relative_path') + group['cover:url']);
        }
        else {
            group['cover:url'] = require('../coverPhoto').getDefaultGroupCover(group.name);
        }
        if (group['cover:thumb:url']) {
            group['cover:thumb:url'] = group['cover:thumb:url'].startsWith('http') ? group['cover:thumb:url'] : (nconf_1.default.get('relative_path') + group['cover:thumb:url']);
        }
        else {
            group['cover:thumb:url'] = require('../coverPhoto').getDefaultGroupCover(group.name);
        }
        group['cover:position'] = validator.escape(String(group['cover:position'] || '50% 50%'));
    }
}
function escapeGroupData(group) {
    if (group) {
        group.nameEncoded = encodeURIComponent(group.name);
        group.displayName = validator.escape(String(group.name));
        group.description = validator.escape(String(group.description || ''));
        group.userTitle = validator.escape(String(group.userTitle || ''));
        group.userTitleEscaped = translator.escape(group.userTitle);
    }
}
