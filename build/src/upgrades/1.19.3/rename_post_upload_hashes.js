/* eslint-disable no-await-in-loop */
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
    name: 'Rename object and sorted sets used in post uploads',
    timestamp: Date.UTC(2022, 1, 10),
    method: function () {
        return __awaiter(this, void 0, void 0, function* () {
            const { progress } = this;
            yield batch.processSortedSet('posts:pid', (pids) => __awaiter(this, void 0, void 0, function* () {
                let keys = pids.map(pid => `post:${pid}:uploads`);
                const exists = yield database_1.default.exists(keys);
                keys = keys.filter((key, idx) => exists[idx]);
                progress.incr(pids.length);
                for (const key of keys) {
                    // Rename the paths within
                    let uploads = yield database_1.default.getSortedSetRangeWithScores(key, 0, -1);
                    // Don't process those that have already the right format
                    uploads = uploads.filter(upload => upload && upload.value && !upload.value.startsWith('files/'));
                    // Rename the zset members
                    yield database_1.default.sortedSetRemove(key, uploads.map(upload => upload.value));
                    yield database_1.default.sortedSetAdd(key, uploads.map(upload => upload.score), uploads.map(upload => `files/${upload.value}`));
                    // Rename the object and pids zsets
                    const hashes = uploads.map(upload => md5(upload.value));
                    const newHashes = uploads.map(upload => md5(`files/${upload.value}`));
                    // cant use db.rename since `fix_user_uploads_zset.js` upgrade script already creates
                    // `upload:md5(upload.value) hash, trying to rename to existing key results in dupe error
                    const oldData = yield database_1.default.getObjects(hashes.map(hash => `upload:${hash}`));
                    const bulkSet = [];
                    oldData.forEach((data, idx) => {
                        if (data) {
                            bulkSet.push([`upload:${newHashes[idx]}`, data]);
                        }
                    });
                    yield database_1.default.setObjectBulk(bulkSet);
                    yield database_1.default.deleteAll(hashes.map(hash => `upload:${hash}`));
                    yield Promise.all(hashes.map((hash, idx) => database_1.default.rename(`upload:${hash}:pids`, `upload:${newHashes[idx]}:pids`)));
                }
            }), {
                batch: 100,
                progress: progress,
            });
        });
    },
};
