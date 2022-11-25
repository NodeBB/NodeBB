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
const meta_1 = __importDefault(require("../meta"));
const plugins = require('../plugins');
const slugify = require('../slugify');
const database = __importStar(require("../database"));
const db = database;
function default_1(Groups) {
    Groups.create = function (data) {
        return __awaiter(this, void 0, void 0, function* () {
            const isSystem = isSystemGroup(data);
            const timestamp = data.timestamp || Date.now();
            let disableJoinRequests = parseInt(data.disableJoinRequests, 10) === 1 ? 1 : 0;
            if (data.name === 'administrators') {
                disableJoinRequests = 1;
            }
            const disableLeave = parseInt(data.disableLeave, 10) === 1 ? 1 : 0;
            const isHidden = parseInt(data.hidden, 10) === 1;
            Groups.validateGroupName(data.name);
            const exists = yield meta_1.default.userOrGroupExists(data.name);
            if (exists) {
                throw new Error('[[error:group-already-exists]]');
            }
            const memberCount = data.hasOwnProperty('ownerUid') ? 1 : 0;
            const isPrivate = data.hasOwnProperty('private') && data.private !== undefined ? parseInt(data.private, 10) === 1 : true;
            let groupData = {
                name: data.name,
                slug: slugify(data.name),
                createtime: timestamp,
                userTitle: data.userTitle || data.name,
                userTitleEnabled: parseInt(data.userTitleEnabled, 10) === 1 ? 1 : 0,
                description: data.description || '',
                memberCount: memberCount,
                hidden: isHidden ? 1 : 0,
                system: isSystem ? 1 : 0,
                private: isPrivate ? 1 : 0,
                disableJoinRequests: disableJoinRequests,
                disableLeave: disableLeave,
            };
            yield plugins.hooks.fire('filter:group.create', { group: groupData, data: data });
            yield db.sortedSetAdd('groups:createtime', groupData.createtime, groupData.name);
            yield db.setObject(`group:${groupData.name}`, groupData);
            if (data.hasOwnProperty('ownerUid')) {
                yield db.setAdd(`group:${groupData.name}:owners`, data.ownerUid);
                yield db.sortedSetAdd(`group:${groupData.name}:members`, timestamp, data.ownerUid);
            }
            if (!isHidden && !isSystem) {
                yield db.sortedSetAddBulk([
                    ['groups:visible:createtime', timestamp, groupData.name],
                    ['groups:visible:memberCount', groupData.memberCount, groupData.name],
                    ['groups:visible:name', 0, `${groupData.name.toLowerCase()}:${groupData.name}`],
                ]);
            }
            yield db.setObjectField('groupslug:groupname', groupData.slug, groupData.name);
            groupData = yield Groups.getGroupData(groupData.name);
            plugins.hooks.fire('action:group.create', { group: groupData });
            return groupData;
        });
    };
    function isSystemGroup(data) {
        return data.system === true || parseInt(data.system, 10) === 1 ||
            Groups.systemGroups.includes(data.name) ||
            Groups.isPrivilegeGroup(data.name);
    }
    Groups.validateGroupName = function (name) {
        if (!name) {
            throw new Error('[[error:group-name-too-short]]');
        }
        if (typeof name !== 'string') {
            throw new Error('[[error:invalid-group-name]]');
        }
        if (!Groups.isPrivilegeGroup(name) && name.length > meta_1.default.config.maximumGroupNameLength) {
            throw new Error('[[error:group-name-too-long]]');
        }
        if (name === 'guests' || (!Groups.isPrivilegeGroup(name) && name.includes(':'))) {
            throw new Error('[[error:invalid-group-name]]');
        }
        if (name.includes('/') || !slugify(name)) {
            throw new Error('[[error:invalid-group-name]]');
        }
    };
}
exports.default = default_1;
;
