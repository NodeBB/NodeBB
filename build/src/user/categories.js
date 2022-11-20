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
const _ = require('lodash');
const database_1 = __importDefault(require("../database"));
const categories = require('../categories');
const plugins = require('../plugins');
function default_1(User) {
    User.setCategoryWatchState = function (uid, cids, state) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!(parseInt(uid, 10) > 0)) {
                return;
            }
            const isStateValid = Object.values(categories.watchStates).includes(parseInt(state, 10));
            if (!isStateValid) {
                throw new Error('[[error:invalid-watch-state]]');
            }
            cids = Array.isArray(cids) ? cids : [cids];
            const exists = yield categories.exists(cids);
            if (exists.includes(false)) {
                throw new Error('[[error:no-category]]');
            }
            yield database_1.default.sortedSetsAdd(cids.map((cid) => `cid:${cid}:uid:watch:state`), state, uid);
        });
    };
    User.getCategoryWatchState = function (uid) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!(parseInt(uid, 10) > 0)) {
                return {};
            }
            const cids = yield categories.getAllCidsFromSet('categories:cid');
            const states = yield categories.getWatchState(cids, uid);
            return _.zipObject(cids, states);
        });
    };
    User.getIgnoredCategories = function (uid) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!(parseInt(uid, 10) > 0)) {
                return [];
            }
            const cids = yield User.getCategoriesByStates(uid, [categories.watchStates.ignoring]);
            const result = yield plugins.hooks.fire('filter:user.getIgnoredCategories', {
                uid: uid,
                cids: cids,
            });
            return result.cids;
        });
    };
    User.getWatchedCategories = function (uid) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!(parseInt(uid, 10) > 0)) {
                return [];
            }
            const cids = yield User.getCategoriesByStates(uid, [categories.watchStates.watching]);
            const result = yield plugins.hooks.fire('filter:user.getWatchedCategories', {
                uid: uid,
                cids: cids,
            });
            return result.cids;
        });
    };
    User.getCategoriesByStates = function (uid, states) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!(parseInt(uid, 10) > 0)) {
                return yield categories.getAllCidsFromSet('categories:cid');
            }
            const cids = yield categories.getAllCidsFromSet('categories:cid');
            const userState = yield categories.getWatchState(cids, uid);
            return cids.filter((cid, index) => states.includes(userState[index]));
        });
    };
    User.ignoreCategory = function (uid, cid) {
        return __awaiter(this, void 0, void 0, function* () {
            yield User.setCategoryWatchState(uid, cid, categories.watchStates.ignoring);
        });
    };
    User.watchCategory = function (uid, cid) {
        return __awaiter(this, void 0, void 0, function* () {
            yield User.setCategoryWatchState(uid, cid, categories.watchStates.watching);
        });
    };
}
exports.default = default_1;
;
