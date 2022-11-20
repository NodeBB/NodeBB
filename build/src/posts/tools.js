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
Object.defineProperty(exports, "__esModule", { value: true });
const privileges = require('../privileges');
function default_1(Posts) {
    Posts.tools = {};
    Posts.tools.delete = function (uid, pid) {
        return __awaiter(this, void 0, void 0, function* () {
            return yield togglePostDelete(uid, pid, true);
        });
    };
    Posts.tools.restore = function (uid, pid) {
        return __awaiter(this, void 0, void 0, function* () {
            return yield togglePostDelete(uid, pid, false);
        });
    };
    function togglePostDelete(uid, pid, isDelete) {
        return __awaiter(this, void 0, void 0, function* () {
            const [postData, canDelete] = yield Promise.all([
                Posts.getPostData(pid),
                privileges.posts.canDelete(pid, uid),
            ]);
            if (!postData) {
                throw new Error('[[error:no-post]]');
            }
            if (postData.deleted && isDelete) {
                throw new Error('[[error:post-already-deleted]]');
            }
            else if (!postData.deleted && !isDelete) {
                throw new Error('[[error:post-already-restored]]');
            }
            if (!canDelete.flag) {
                throw new Error(canDelete.message);
            }
            let post;
            if (isDelete) {
                require('./cache').del(pid);
                post = yield Posts.delete(pid, uid);
            }
            else {
                post = yield Posts.restore(pid, uid);
                post = yield Posts.parsePost(post);
            }
            return post;
        });
    }
}
exports.default = default_1;
;
