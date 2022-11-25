/* eslint-disable no-await-in-loop */
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
Object.defineProperty(exports, "__esModule", { value: true });
const crypto = require('crypto');
const database = __importStar(require("../../database"));
const db = database;
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
                const exists = yield db.exists(keys);
                keys = keys.filter((key, idx) => exists[idx]);
                progress.incr(pids.length);
                for (const key of keys) {
                    // Rename the paths within
                    let uploads = yield db.getSortedSetRangeWithScores(key, 0, -1);
                    // Don't process those that have already the right format
                    uploads = uploads.filter(upload => upload && upload.value && !upload.value.startsWith('files/'));
                    // Rename the zset members
                    yield db.sortedSetRemove(key, uploads.map(upload => upload.value));
                    yield db.sortedSetAdd(key, uploads.map(upload => upload.score), uploads.map(upload => `files/${upload.value}`));
                    // Rename the object and pids zsets
                    const hashes = uploads.map(upload => md5(upload.value));
                    const newHashes = uploads.map(upload => md5(`files/${upload.value}`));
                    // cant use db.rename since `fix_user_uploads_zset.js` upgrade script already creates
                    // `upload:md5(upload.value) hash, trying to rename to existing key results in dupe error
                    const oldData = yield db.getObjects(hashes.map(hash => `upload:${hash}`));
                    const bulkSet = [];
                    oldData.forEach((data, idx) => {
                        if (data) {
                            bulkSet.push([`upload:${newHashes[idx]}`, data]);
                        }
                    });
                    yield db.setObjectBulk(bulkSet);
                    yield db.deleteAll(hashes.map(hash => `upload:${hash}`));
                    yield Promise.all(hashes.map((hash, idx) => db.rename(`upload:${hash}:pids`, `upload:${newHashes[idx]}:pids`)));
                }
            }), {
                batch: 100,
                progress: progress,
            });
        });
    },
};
