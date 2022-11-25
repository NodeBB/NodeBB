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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const nconf_1 = __importDefault(require("nconf"));
const fs = require('fs').promises;
const crypto = require('crypto');
const path_1 = __importDefault(require("path"));
const winston_1 = __importDefault(require("winston"));
const mime = require('mime');
const validator = require('validator');
const cronJob = require('cron').CronJob;
const chalk = require('chalk');
const database = __importStar(require("../database"));
const db = database;
const image = require('../image');
const user_1 = __importDefault(require("../user"));
const topics = require('../topics');
const file = require('../file');
const meta_1 = __importDefault(require("../meta"));
function default_1(Posts) {
    Posts.uploads = {};
    const md5 = filename => crypto.createHash('md5').update(filename).digest('hex');
    const pathPrefix = path_1.default.join(nconf_1.default.get('upload_path'));
    const searchRegex = /\/assets\/uploads\/(files\/[^\s")]+\.?[\w]*)/g;
    const _getFullPath = relativePath => path_1.default.join(pathPrefix, relativePath);
    const _filterValidPaths = (filePaths) => __awaiter(this, void 0, void 0, function* () {
        return (yield Promise.all(filePaths.map((filePath) => __awaiter(this, void 0, void 0, function* () {
            const fullPath = _getFullPath(filePath);
            return fullPath.startsWith(pathPrefix) && (yield file.exists(fullPath)) ? filePath : false;
        })))).filter(Boolean);
    });
    const runJobs = nconf_1.default.get('runJobs');
    if (runJobs) {
        new cronJob('0 2 * * 0', () => __awaiter(this, void 0, void 0, function* () {
            const orphans = yield Posts.uploads.cleanOrphans();
            if (orphans.length) {
                winston_1.default.info(`[posts/uploads] Deleting ${orphans.length} orphaned uploads...`);
                orphans.forEach((relPath) => {
                    process.stdout.write(`${chalk.red('  - ')} ${relPath}`);
                });
            }
        }), null, true);
    }
    Posts.uploads.sync = function (pid) {
        return __awaiter(this, void 0, void 0, function* () {
            // Scans a post's content and updates sorted set of uploads
            const [content, currentUploads, isMainPost] = yield Promise.all([
                Posts.getPostField(pid, 'content'),
                Posts.uploads.list(pid),
                Posts.isMain(pid),
            ]);
            // Extract upload file paths from post content
            let match = searchRegex.exec(content);
            const uploads = [];
            while (match) {
                uploads.push(match[1].replace('-resized', ''));
                match = searchRegex.exec(content);
            }
            // Main posts can contain topic thumbs, which are also tracked by pid
            if (isMainPost) {
                const tid = yield Posts.getPostField(pid, 'tid');
                let thumbs = yield topics.thumbs.get(tid);
                const replacePath = path_1.default.posix.join(`${nconf_1.default.get('relative_path')}${nconf_1.default.get('upload_url')}/`);
                thumbs = thumbs.map(thumb => thumb.url.replace(replacePath, '')).filter(path => !validator.isURL(path, {
                    require_protocol: true,
                }));
                uploads.push(...thumbs);
            }
            // Create add/remove sets
            const add = uploads.filter(path => !currentUploads.includes(path));
            const remove = currentUploads.filter(path => !uploads.includes(path));
            yield Promise.all([
                Posts.uploads.associate(pid, add),
                Posts.uploads.dissociate(pid, remove),
            ]);
        });
    };
    Posts.uploads.list = function (pid) {
        return __awaiter(this, void 0, void 0, function* () {
            return yield db.getSortedSetMembers(`post:${pid}:uploads`);
        });
    };
    Posts.uploads.listWithSizes = function (pid) {
        return __awaiter(this, void 0, void 0, function* () {
            const paths = yield Posts.uploads.list(pid);
            const sizes = (yield db.getObjects(paths.map(path => `upload:${md5(path)}`))) || [];
            return sizes.map((sizeObj, idx) => (Object.assign(Object.assign({}, sizeObj), { name: paths[idx] })));
        });
    };
    Posts.uploads.getOrphans = () => __awaiter(this, void 0, void 0, function* () {
        let files = yield fs.readdir(_getFullPath('/files'));
        files = files.filter(filename => filename !== '.gitignore');
        // Exclude non-timestamped files (e.g. group covers; see gh#10783/gh#10705)
        const tsPrefix = /^\d{13}-/;
        files = files.filter(filename => tsPrefix.test(filename));
        files = yield Promise.all(files.map((filename) => __awaiter(this, void 0, void 0, function* () { return ((yield Posts.uploads.isOrphan(`files/${filename}`)) ? `files/${filename}` : null); })));
        files = files.filter(Boolean);
        return files;
    });
    Posts.uploads.cleanOrphans = () => __awaiter(this, void 0, void 0, function* () {
        const now = Date.now();
        const expiration = now - (1000 * 60 * 60 * 24 * meta_1.default.config.orphanExpiryDays);
        const days = meta_1.default.config.orphanExpiryDays;
        if (!days) {
            return [];
        }
        let orphans = yield Posts.uploads.getOrphans();
        orphans = yield Promise.all(orphans.map((relPath) => __awaiter(this, void 0, void 0, function* () {
            const { mtimeMs } = yield fs.stat(_getFullPath(relPath));
            return mtimeMs < expiration ? relPath : null;
        })));
        orphans = orphans.filter(Boolean);
        // Note: no await. Deletion not guaranteed by method end.
        orphans.forEach((relPath) => {
            file.delete(_getFullPath(relPath));
        });
        return orphans;
    });
    Posts.uploads.isOrphan = function (filePath) {
        return __awaiter(this, void 0, void 0, function* () {
            const length = yield db.sortedSetCard(`upload:${md5(filePath)}:pids`);
            return length === 0;
        });
    };
    Posts.uploads.getUsage = function (filePaths) {
        return __awaiter(this, void 0, void 0, function* () {
            // Given an array of file names, determines which pids they are used in
            if (!Array.isArray(filePaths)) {
                filePaths = [filePaths];
            }
            const keys = filePaths.map(fileObj => `upload:${md5(fileObj.path.replace('-resized', ''))}:pids`);
            return yield Promise.all(keys.map(k => db.getSortedSetRange(k, 0, -1)));
        });
    };
    Posts.uploads.associate = function (pid, filePaths) {
        return __awaiter(this, void 0, void 0, function* () {
            // Adds an upload to a post's sorted set of uploads
            filePaths = !Array.isArray(filePaths) ? [filePaths] : filePaths;
            if (!filePaths.length) {
                return;
            }
            filePaths = yield _filterValidPaths(filePaths); // Only process files that exist and are within uploads directory
            const now = Date.now();
            const scores = filePaths.map(() => now);
            const bulkAdd = filePaths.map(path => [`upload:${md5(path)}:pids`, now, pid]);
            yield Promise.all([
                db.sortedSetAdd(`post:${pid}:uploads`, scores, filePaths),
                db.sortedSetAddBulk(bulkAdd),
                Posts.uploads.saveSize(filePaths),
            ]);
        });
    };
    Posts.uploads.dissociate = function (pid, filePaths) {
        return __awaiter(this, void 0, void 0, function* () {
            // Removes an upload from a post's sorted set of uploads
            filePaths = !Array.isArray(filePaths) ? [filePaths] : filePaths;
            if (!filePaths.length) {
                return;
            }
            const bulkRemove = filePaths.map(path => [`upload:${md5(path)}:pids`, pid]);
            const promises = [
                db.sortedSetRemove(`post:${pid}:uploads`, filePaths),
                db.sortedSetRemoveBulk(bulkRemove),
            ];
            yield Promise.all(promises);
            if (!meta_1.default.config.preserveOrphanedUploads) {
                const deletePaths = (yield Promise.all(filePaths.map((filePath) => __awaiter(this, void 0, void 0, function* () { return ((yield Posts.uploads.isOrphan(filePath)) ? filePath : false); })))).filter(Boolean);
                const uploaderUids = (yield db.getObjectsFields(deletePaths.map(path => `upload:${md5(path)}`, ['uid']))).map(o => (o ? o.uid || null : null));
                yield Promise.all(uploaderUids.map((uid, idx) => (uid && isFinite(uid) ? user_1.default.deleteUpload(uid, uid, deletePaths[idx]) : null)).filter(Boolean));
                yield Posts.uploads.deleteFromDisk(deletePaths);
            }
        });
    };
    Posts.uploads.dissociateAll = (pid) => __awaiter(this, void 0, void 0, function* () {
        const current = yield Posts.uploads.list(pid);
        yield Posts.uploads.dissociate(pid, current);
    });
    Posts.uploads.deleteFromDisk = (filePaths) => __awaiter(this, void 0, void 0, function* () {
        if (typeof filePaths === 'string') {
            filePaths = [filePaths];
        }
        else if (!Array.isArray(filePaths)) {
            throw new Error(`[[error:wrong-parameter-type, filePaths, ${typeof filePaths}, array]]`);
        }
        filePaths = (yield _filterValidPaths(filePaths)).map(_getFullPath);
        yield Promise.all(filePaths.map(file.delete));
    });
    Posts.uploads.saveSize = (filePaths) => __awaiter(this, void 0, void 0, function* () {
        filePaths = filePaths.filter((fileName) => {
            const type = mime.getType(fileName);
            return type && type.match(/image./);
        });
        yield Promise.all(filePaths.map((fileName) => __awaiter(this, void 0, void 0, function* () {
            try {
                const size = yield image.size(_getFullPath(fileName));
                yield db.setObject(`upload:${md5(fileName)}`, {
                    width: size.width,
                    height: size.height,
                });
            }
            catch (err) {
                winston_1.default.error(`[posts/uploads] Error while saving post upload sizes (${fileName}): ${err.message}`);
            }
        })));
    });
}
exports.default = default_1;
;
