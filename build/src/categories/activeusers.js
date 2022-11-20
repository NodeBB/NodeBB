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
const posts = require('../posts');
const database_1 = __importDefault(require("../database"));
function default_1(Categories) {
    Categories.getActiveUsers = function (cids) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!Array.isArray(cids)) {
                cids = [cids];
            }
            const pids = yield database_1.default.getSortedSetRevRange(cids.map((cid) => `cid:${cid}:pids`), 0, 24);
            const postData = yield posts.getPostsFields(pids, ['uid']);
            return _.uniq(postData.map(post => post.uid).filter(uid => uid));
        });
    };
}
exports.default = default_1;
;
