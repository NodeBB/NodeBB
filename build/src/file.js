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
const fs_1 = __importDefault(require("fs"));
const nconf_1 = __importDefault(require("nconf"));
const path_1 = __importDefault(require("path"));
const winston_1 = __importDefault(require("winston"));
const mkdirp = require('mkdirp');
const mime = require('mime');
const graceful = require('graceful-fs');
const slugify = require('./slugify');
graceful.gracefulify(fs_1.default);
const file = {};
file.saveFileToLocal = function (filename, folder, tempPath) {
    return __awaiter(this, void 0, void 0, function* () {
        /*
         * remarkable doesn't allow spaces in hyperlinks, once that's fixed, remove this.
         */
        filename = filename.split('.').map(name => slugify(name)).join('.');
        const uploadPath = path_1.default.join(nconf_1.default.get('upload_path'), folder, filename);
        if (!uploadPath.startsWith(nconf_1.default.get('upload_path'))) {
            throw new Error('[[error:invalid-path]]');
        }
        winston_1.default.verbose(`Saving file ${filename} to : ${uploadPath}`);
        yield mkdirp(path_1.default.dirname(uploadPath));
        yield fs_1.default.promises.copyFile(tempPath, uploadPath);
        return {
            url: `/assets/uploads/${folder ? `${folder}/` : ''}${filename}`,
            path: uploadPath,
        };
    });
};
file.base64ToLocal = function (imageData, uploadPath) {
    return __awaiter(this, void 0, void 0, function* () {
        const buffer = Buffer.from(imageData.slice(imageData.indexOf('base64') + 7), 'base64');
        uploadPath = path_1.default.join(nconf_1.default.get('upload_path'), uploadPath);
        yield fs_1.default.promises.writeFile(uploadPath, buffer, {
            encoding: 'base64',
        });
        return uploadPath;
    });
};
// https://stackoverflow.com/a/31205878/583363
file.appendToFileName = function (filename, string) {
    const dotIndex = filename.lastIndexOf('.');
    if (dotIndex === -1) {
        return filename + string;
    }
    return filename.substring(0, dotIndex) + string + filename.substring(dotIndex);
};
file.allowedExtensions = function () {
    const meta = require('./meta');
    let allowedExtensions = (meta.config.allowedFileExtensions || '').trim();
    if (!allowedExtensions) {
        return [];
    }
    allowedExtensions = allowedExtensions.split(',');
    allowedExtensions = allowedExtensions.filter(Boolean).map((extension) => {
        extension = extension.trim();
        if (!extension.startsWith('.')) {
            extension = `.${extension}`;
        }
        return extension.toLowerCase();
    });
    if (allowedExtensions.includes('.jpg') && !allowedExtensions.includes('.jpeg')) {
        allowedExtensions.push('.jpeg');
    }
    return allowedExtensions;
};
file.exists = function (path) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            yield fs_1.default.promises.stat(path);
        }
        catch (err) {
            if (err.code === 'ENOENT') {
                return false;
            }
            throw err;
        }
        return true;
    });
};
file.existsSync = function (path) {
    try {
        fs_1.default.statSync(path);
    }
    catch (err) {
        if (err.code === 'ENOENT') {
            return false;
        }
        throw err;
    }
    return true;
};
file.delete = function (path) {
    return __awaiter(this, void 0, void 0, function* () {
        if (!path) {
            return;
        }
        try {
            yield fs_1.default.promises.unlink(path);
        }
        catch (err) {
            if (err.code === 'ENOENT') {
                winston_1.default.verbose(`[file] Attempted to delete non-existent file: ${path}`);
                return;
            }
            winston_1.default.warn(err);
        }
    });
};
file.link = function link(filePath, destPath, relative) {
    return __awaiter(this, void 0, void 0, function* () {
        if (relative && process.platform !== 'win32') {
            filePath = path_1.default.relative(path_1.default.dirname(destPath), filePath);
        }
        if (process.platform === 'win32') {
            yield fs_1.default.promises.link(filePath, destPath);
        }
        else {
            yield fs_1.default.promises.symlink(filePath, destPath, 'file');
        }
    });
};
file.linkDirs = function linkDirs(sourceDir, destDir, relative) {
    return __awaiter(this, void 0, void 0, function* () {
        if (relative && process.platform !== 'win32') {
            sourceDir = path_1.default.relative(path_1.default.dirname(destDir), sourceDir);
        }
        const type = (process.platform === 'win32') ? 'junction' : 'dir';
        yield fs_1.default.promises.symlink(sourceDir, destDir, type);
    });
};
file.typeToExtension = function (type) {
    let extension = '';
    if (type) {
        extension = `.${mime.getExtension(type)}`;
    }
    return extension;
};
// Adapted from http://stackoverflow.com/questions/5827612/node-js-fs-readdir-recursive-directory-search
file.walk = function (dir) {
    return __awaiter(this, void 0, void 0, function* () {
        const subdirs = yield fs_1.default.promises.readdir(dir);
        const files = yield Promise.all(subdirs.map((subdir) => __awaiter(this, void 0, void 0, function* () {
            const res = path_1.default.resolve(dir, subdir);
            return (yield fs_1.default.promises.stat(res)).isDirectory() ? file.walk(res) : res;
        })));
        return files.reduce((a, f) => a.concat(f), []);
    });
};
const promisify_1 = require("./promisify");
(0, promisify_1.promisify)(file);
exports.default = file;
