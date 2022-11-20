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
const plugins = require('../plugins');
function default_1(Groups) {
    Groups.ownership = {};
    Groups.ownership.isOwner = function (uid, groupName) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!(parseInt(uid, 10) > 0)) {
                return false;
            }
            return yield database_1.default.isSetMember(`group:${groupName}:owners`, uid);
        });
    };
    Groups.ownership.isOwners = function (uids, groupName) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!Array.isArray(uids)) {
                return [];
            }
            return yield database_1.default.isSetMembers(`group:${groupName}:owners`, uids);
        });
    };
    Groups.ownership.grant = function (toUid, groupName) {
        return __awaiter(this, void 0, void 0, function* () {
            yield database_1.default.setAdd(`group:${groupName}:owners`, toUid);
            plugins.hooks.fire('action:group.grantOwnership', { uid: toUid, groupName: groupName });
        });
    };
    Groups.ownership.rescind = function (toUid, groupName) {
        return __awaiter(this, void 0, void 0, function* () {
            // If the owners set only contains one member (and toUid is that member), error out!
            const numOwners = yield database_1.default.setCount(`group:${groupName}:owners`);
            const isOwner = yield database_1.default.isSortedSetMember(`group:${groupName}:owners`);
            if (numOwners <= 1 && isOwner) {
                throw new Error('[[error:group-needs-owner]]');
            }
            yield database_1.default.setRemove(`group:${groupName}:owners`, toUid);
            plugins.hooks.fire('action:group.rescindOwnership', { uid: toUid, groupName: groupName });
        });
    };
}
exports.default = default_1;
;
