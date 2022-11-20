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
const database_1 = __importDefault(require("../../database"));
const batch = require('../../batch');
exports.default = {
    name: 'Clean up post hash data',
    timestamp: Date.UTC(2019, 9, 7),
    method: function () {
        return __awaiter(this, void 0, void 0, function* () {
            const { progress } = this;
            yield cleanPost(progress);
            yield cleanTopic(progress);
        });
    },
};
function cleanPost(progress) {
    return __awaiter(this, void 0, void 0, function* () {
        yield batch.processSortedSet('posts:pid', (pids) => __awaiter(this, void 0, void 0, function* () {
            progress.incr(pids.length);
            const postData = yield database_1.default.getObjects(pids.map(pid => `post:${pid}`));
            yield Promise.all(postData.map((post) => __awaiter(this, void 0, void 0, function* () {
                if (!post) {
                    return;
                }
                const fieldsToDelete = [];
                if (post.hasOwnProperty('editor') && post.editor === '') {
                    fieldsToDelete.push('editor');
                }
                if (post.hasOwnProperty('deleted') && parseInt(post.deleted, 10) === 0) {
                    fieldsToDelete.push('deleted');
                }
                if (post.hasOwnProperty('edited') && parseInt(post.edited, 10) === 0) {
                    fieldsToDelete.push('edited');
                }
                // cleanup legacy fields, these are not used anymore
                const legacyFields = [
                    'show_banned', 'fav_star_class', 'relativeEditTime',
                    'post_rep', 'relativeTime', 'fav_button_class',
                    'edited-class',
                ];
                legacyFields.forEach((field) => {
                    if (post.hasOwnProperty(field)) {
                        fieldsToDelete.push(field);
                    }
                });
                if (fieldsToDelete.length) {
                    yield database_1.default.deleteObjectFields(`post:${post.pid}`, fieldsToDelete);
                }
            })));
        }), {
            batch: 500,
            progress: progress,
        });
    });
}
function cleanTopic(progress) {
    return __awaiter(this, void 0, void 0, function* () {
        yield batch.processSortedSet('topics:tid', (tids) => __awaiter(this, void 0, void 0, function* () {
            progress.incr(tids.length);
            const topicData = yield database_1.default.getObjects(tids.map(tid => `topic:${tid}`));
            yield Promise.all(topicData.map((topic) => __awaiter(this, void 0, void 0, function* () {
                if (!topic) {
                    return;
                }
                const fieldsToDelete = [];
                if (topic.hasOwnProperty('deleted') && parseInt(topic.deleted, 10) === 0) {
                    fieldsToDelete.push('deleted');
                }
                if (topic.hasOwnProperty('pinned') && parseInt(topic.pinned, 10) === 0) {
                    fieldsToDelete.push('pinned');
                }
                if (topic.hasOwnProperty('locked') && parseInt(topic.locked, 10) === 0) {
                    fieldsToDelete.push('locked');
                }
                // cleanup legacy fields, these are not used anymore
                const legacyFields = [
                    'category_name', 'category_slug',
                ];
                legacyFields.forEach((field) => {
                    if (topic.hasOwnProperty(field)) {
                        fieldsToDelete.push(field);
                    }
                });
                if (fieldsToDelete.length) {
                    yield database_1.default.deleteObjectFields(`topic:${topic.tid}`, fieldsToDelete);
                }
            })));
        }), {
            batch: 500,
            progress: progress,
        });
    });
}
