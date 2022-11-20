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
const user_1 = __importDefault(require("../../user"));
exports.default = {
    name: 'Clean up old notifications and hash data',
    timestamp: Date.UTC(2019, 9, 7),
    method: function () {
        return __awaiter(this, void 0, void 0, function* () {
            const { progress } = this;
            const week = 604800000;
            const cutoffTime = Date.now() - week;
            yield batch.processSortedSet('users:joindate', (uids) => __awaiter(this, void 0, void 0, function* () {
                progress.incr(uids.length);
                yield Promise.all([
                    database_1.default.sortedSetsRemoveRangeByScore(uids.map(uid => `uid:${uid}:notifications:unread`), '-inf', cutoffTime),
                    database_1.default.sortedSetsRemoveRangeByScore(uids.map(uid => `uid:${uid}:notifications:read`), '-inf', cutoffTime),
                ]);
                const userData = yield user_1.default.getUsersData(uids);
                yield Promise.all(userData.map((user) => __awaiter(this, void 0, void 0, function* () {
                    if (!user) {
                        return;
                    }
                    const fields = [];
                    ['picture', 'fullname', 'location', 'birthday', 'website', 'signature', 'uploadedpicture'].forEach((field) => {
                        if (user[field] === '') {
                            fields.push(field);
                        }
                    });
                    ['profileviews', 'reputation', 'postcount', 'topiccount', 'lastposttime', 'banned', 'followerCount', 'followingCount'].forEach((field) => {
                        if (user[field] === 0) {
                            fields.push(field);
                        }
                    });
                    if (user['icon:text']) {
                        fields.push('icon:text');
                    }
                    if (user['icon:bgColor']) {
                        fields.push('icon:bgColor');
                    }
                    if (fields.length) {
                        yield database_1.default.deleteObjectFields(`user:${user.uid}`, fields);
                    }
                })));
            }), {
                batch: 500,
                progress: progress,
            });
        });
    },
};
