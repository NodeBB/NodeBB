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
const crypto = require('crypto');
const database_1 = __importDefault(require("../../database"));
const batch = require('../../batch');
const md5 = filename => crypto.createHash('md5').update(filename).digest('hex');
exports.default = {
    name: 'Fix paths in user uploads sorted sets',
    timestamp: Date.UTC(2022, 1, 10),
    method: function () {
        return __awaiter(this, void 0, void 0, function* () {
            const { progress } = this;
            yield batch.processSortedSet('users:joindate', (uids) => __awaiter(this, void 0, void 0, function* () {
                progress.incr(uids.length);
                yield Promise.all(uids.map((uid) => __awaiter(this, void 0, void 0, function* () {
                    const key = `uid:${uid}:uploads`;
                    // Rename the paths within
                    let uploads = yield database_1.default.getSortedSetRangeWithScores(key, 0, -1);
                    if (uploads.length) {
                        // Don't process those that have already the right format
                        uploads = uploads.filter(upload => upload.value.startsWith('/files/'));
                        yield database_1.default.sortedSetRemove(key, uploads.map(upload => upload.value));
                        yield database_1.default.sortedSetAdd(key, uploads.map(upload => upload.score), uploads.map(upload => upload.value.slice(1)));
                        // Add uid to the upload's hash object
                        uploads = yield database_1.default.getSortedSetMembers(key);
                        yield database_1.default.setObjectBulk(uploads.map(relativePath => [`upload:${md5(relativePath)}`, { uid: uid }]));
                    }
                })));
            }), {
                batch: 500,
                progress: progress,
            });
        });
    },
};
