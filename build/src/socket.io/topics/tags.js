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
const meta_1 = __importDefault(require("../../meta"));
const user_1 = __importDefault(require("../../user"));
const topics = require('../../topics');
const categories_1 = __importDefault(require("../../categories"));
const privileges = require('../../privileges');
const utils = require('../../utils');
function default_1(SocketTopics) {
    SocketTopics.isTagAllowed = function (socket, data) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!data || !utils.isNumber(data.cid) || !data.tag) {
                throw new Error('[[error:invalid-data]]');
            }
            const systemTags = (meta_1.default.config.systemTags || '').split(',');
            const [tagWhitelist, isPrivileged] = yield Promise.all([
                categories_1.default.getTagWhitelist([data.cid]),
                user_1.default.isPrivileged(socket.uid),
            ]);
            return isPrivileged ||
                (!systemTags.includes(data.tag) &&
                    (!tagWhitelist[0].length || tagWhitelist[0].includes(data.tag)));
        });
    };
    SocketTopics.canRemoveTag = function (socket, data) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!data || !data.tag) {
                throw new Error('[[error:invalid-data]]');
            }
            const systemTags = (meta_1.default.config.systemTags || '').split(',');
            const isPrivileged = yield user_1.default.isPrivileged(socket.uid);
            return isPrivileged || !systemTags.includes(String(data.tag).trim());
        });
    };
    SocketTopics.autocompleteTags = function (socket, data) {
        return __awaiter(this, void 0, void 0, function* () {
            if (data.cid) {
                const canRead = yield privileges.categories.can('topics:read', data.cid, socket.uid);
                if (!canRead) {
                    throw new Error('[[error:no-privileges]]');
                }
            }
            data.cids = yield categories_1.default.getCidsByPrivilege('categories:cid', socket.uid, 'topics:read');
            const result = yield topics.autocompleteTags(data);
            return result.map(tag => tag.value);
        });
    };
    SocketTopics.searchTags = function (socket, data) {
        return __awaiter(this, void 0, void 0, function* () {
            const result = yield searchTags(socket.uid, topics.searchTags, data);
            return result.map(tag => tag.value);
        });
    };
    SocketTopics.searchAndLoadTags = function (socket, data) {
        return __awaiter(this, void 0, void 0, function* () {
            return yield searchTags(socket.uid, topics.searchAndLoadTags, data);
        });
    };
    function searchTags(uid, method, data) {
        return __awaiter(this, void 0, void 0, function* () {
            const allowed = yield privileges.global.can('search:tags', uid);
            if (!allowed) {
                throw new Error('[[error:no-privileges]]');
            }
            if (data.cid) {
                const canRead = yield privileges.categories.can('topics:read', data.cid, uid);
                if (!canRead) {
                    throw new Error('[[error:no-privileges]]');
                }
            }
            data.cids = yield categories_1.default.getCidsByPrivilege('categories:cid', uid, 'topics:read');
            return yield method(data);
        });
    }
    SocketTopics.loadMoreTags = function (socket, data) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!data || !utils.isNumber(data.after)) {
                throw new Error('[[error:invalid-data]]');
            }
            const start = parseInt(data.after, 10);
            const stop = start + 99;
            const cids = yield categories_1.default.getCidsByPrivilege('categories:cid', socket.uid, 'topics:read');
            const tags = yield topics.getCategoryTagsData(cids, start, stop);
            return { tags: tags.filter(Boolean), nextStart: stop + 1 };
        });
    };
}
exports.default = default_1;
;
