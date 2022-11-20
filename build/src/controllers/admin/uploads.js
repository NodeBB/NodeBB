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
const path_1 = __importDefault(require("path"));
const nconf_1 = __importDefault(require("nconf"));
const fs = __importStar(require("fs"));
const meta_1 = __importDefault(require("../../meta"));
const posts = require('../../posts');
const file = require('../../file');
const image = require('../../image');
const plugins = require('../../plugins');
const pagination = require('../../pagination');
const allowedImageTypes = ['image/png', 'image/jpeg', 'image/pjpeg', 'image/jpg', 'image/gif', 'image/svg+xml'];
const uploadsController = {};
uploadsController.get = function (req, res, next) {
    return __awaiter(this, void 0, void 0, function* () {
        const currentFolder = path_1.default.join(nconf_1.default.get('upload_path'), req.query.dir || '');
        if (!currentFolder.startsWith(nconf_1.default.get('upload_path'))) {
            return next(new Error('[[error:invalid-path]]'));
        }
        const itemsPerPage = 20;
        const page = parseInt(req.query.page, 10) || 1;
        try {
            let files = yield fs.promises.readdir(currentFolder);
            files = files.filter(filename => filename !== '.gitignore');
            const itemCount = files.length;
            const start = Math.max(0, (page - 1) * itemsPerPage);
            const stop = start + itemsPerPage;
            files = files.slice(start, stop);
            files = yield filesToData(currentFolder, files);
            // Float directories to the top
            files.sort((a, b) => {
                if (a.isDirectory && !b.isDirectory) {
                    return -1;
                }
                else if (!a.isDirectory && b.isDirectory) {
                    return 1;
                }
                else if (!a.isDirectory && !b.isDirectory) {
                    return a.mtime < b.mtime ? -1 : 1;
                }
                return 0;
            });
            // Add post usage info if in /files
            if (['files', '/files', '/files/'].includes(req.query.dir)) {
                const usage = yield posts.uploads.getUsage(files);
                files.forEach((file, idx) => {
                    file.inPids = usage[idx].map(pid => parseInt(pid, 10));
                });
            }
            res.render('admin/manage/uploads', {
                currentFolder: currentFolder.replace(nconf_1.default.get('upload_path'), ''),
                showPids: files.length && files[0].hasOwnProperty('inPids'),
                files: files,
                breadcrumbs: buildBreadcrumbs(currentFolder),
                pagination: pagination.create(page, Math.ceil(itemCount / itemsPerPage), req.query),
            });
        }
        catch (err) {
            next(err);
        }
    });
};
function buildBreadcrumbs(currentFolder) {
    const crumbs = [];
    const parts = currentFolder.replace(nconf_1.default.get('upload_path'), '').split(path_1.default.sep);
    let currentPath = '';
    parts.forEach((part) => {
        const dir = path_1.default.join(currentPath, part);
        crumbs.push({
            text: part || 'Uploads',
            url: part ?
                (`${nconf_1.default.get('relative_path')}/admin/manage/uploads?dir=${dir}`) :
                `${nconf_1.default.get('relative_path')}/admin/manage/uploads`,
        });
        currentPath = dir;
    });
    return crumbs;
}
function filesToData(currentDir, files) {
    return __awaiter(this, void 0, void 0, function* () {
        return yield Promise.all(files.map(file => getFileData(currentDir, file)));
    });
}
function getFileData(currentDir, file) {
    return __awaiter(this, void 0, void 0, function* () {
        const pathToFile = path_1.default.join(currentDir, file);
        const stat = yield fs.promises.stat(pathToFile);
        let filesInDir = [];
        if (stat.isDirectory()) {
            filesInDir = yield fs.promises.readdir(pathToFile);
        }
        const url = `${nconf_1.default.get('upload_url') + currentDir.replace(nconf_1.default.get('upload_path'), '')}/${file}`;
        return {
            name: file,
            path: pathToFile.replace(path_1.default.join(nconf_1.default.get('upload_path'), '/'), ''),
            url: url,
            fileCount: Math.max(0, filesInDir.length - 1),
            size: stat.size,
            sizeHumanReadable: `${(stat.size / 1024).toFixed(1)}KiB`,
            isDirectory: stat.isDirectory(),
            isFile: stat.isFile(),
            mtime: stat.mtimeMs,
        };
    });
}
uploadsController.uploadCategoryPicture = function (req, res, next) {
    return __awaiter(this, void 0, void 0, function* () {
        const uploadedFile = req.files.files[0];
        let params = null;
        try {
            params = JSON.parse(req.body.params);
        }
        catch (e) {
            file.delete(uploadedFile.path);
            return next(new Error('[[error:invalid-json]]'));
        }
        if (validateUpload(res, uploadedFile, allowedImageTypes)) {
            const filename = `category-${params.cid}${path_1.default.extname(uploadedFile.name)}`;
            yield uploadImage(filename, 'category', uploadedFile, req, res, next);
        }
    });
};
uploadsController.uploadFavicon = function (req, res, next) {
    return __awaiter(this, void 0, void 0, function* () {
        const uploadedFile = req.files.files[0];
        const allowedTypes = ['image/x-icon', 'image/vnd.microsoft.icon'];
        if (validateUpload(res, uploadedFile, allowedTypes)) {
            try {
                const imageObj = yield file.saveFileToLocal('favicon.ico', 'system', uploadedFile.path);
                res.json([{ name: uploadedFile.name, url: imageObj.url }]);
            }
            catch (err) {
                next(err);
            }
            finally {
                file.delete(uploadedFile.path);
            }
        }
    });
};
uploadsController.uploadTouchIcon = function (req, res, next) {
    return __awaiter(this, void 0, void 0, function* () {
        const uploadedFile = req.files.files[0];
        const allowedTypes = ['image/png'];
        const sizes = [36, 48, 72, 96, 144, 192, 512];
        if (validateUpload(res, uploadedFile, allowedTypes)) {
            try {
                const imageObj = yield file.saveFileToLocal('touchicon-orig.png', 'system', uploadedFile.path);
                // Resize the image into squares for use as touch icons at various DPIs
                for (const size of sizes) {
                    /* eslint-disable no-await-in-loop */
                    yield image.resizeImage({
                        path: uploadedFile.path,
                        target: path_1.default.join(nconf_1.default.get('upload_path'), 'system', `touchicon-${size}.png`),
                        width: size,
                        height: size,
                    });
                }
                res.json([{ name: uploadedFile.name, url: imageObj.url }]);
            }
            catch (err) {
                next(err);
            }
            finally {
                file.delete(uploadedFile.path);
            }
        }
    });
};
uploadsController.uploadMaskableIcon = function (req, res, next) {
    return __awaiter(this, void 0, void 0, function* () {
        const uploadedFile = req.files.files[0];
        const allowedTypes = ['image/png'];
        if (validateUpload(res, uploadedFile, allowedTypes)) {
            try {
                const imageObj = yield file.saveFileToLocal('maskableicon-orig.png', 'system', uploadedFile.path);
                res.json([{ name: uploadedFile.name, url: imageObj.url }]);
            }
            catch (err) {
                next(err);
            }
            finally {
                file.delete(uploadedFile.path);
            }
        }
    });
};
uploadsController.uploadLogo = function (req, res, next) {
    return __awaiter(this, void 0, void 0, function* () {
        yield upload('site-logo', req, res, next);
    });
};
uploadsController.uploadFile = function (req, res, next) {
    return __awaiter(this, void 0, void 0, function* () {
        const uploadedFile = req.files.files[0];
        let params;
        try {
            params = JSON.parse(req.body.params);
        }
        catch (e) {
            file.delete(uploadedFile.path);
            return next(new Error('[[error:invalid-json]]'));
        }
        try {
            const data = yield file.saveFileToLocal(uploadedFile.name, params.folder, uploadedFile.path);
            res.json([{ url: data.url }]);
        }
        catch (err) {
            next(err);
        }
        finally {
            file.delete(uploadedFile.path);
        }
    });
};
uploadsController.uploadDefaultAvatar = function (req, res, next) {
    return __awaiter(this, void 0, void 0, function* () {
        yield upload('avatar-default', req, res, next);
    });
};
uploadsController.uploadOgImage = function (req, res, next) {
    return __awaiter(this, void 0, void 0, function* () {
        yield upload('og:image', req, res, next);
    });
};
function upload(name, req, res, next) {
    return __awaiter(this, void 0, void 0, function* () {
        const uploadedFile = req.files.files[0];
        if (validateUpload(res, uploadedFile, allowedImageTypes)) {
            const filename = name + path_1.default.extname(uploadedFile.name);
            yield uploadImage(filename, 'system', uploadedFile, req, res, next);
        }
    });
}
function validateUpload(res, uploadedFile, allowedTypes) {
    if (!allowedTypes.includes(uploadedFile.type)) {
        file.delete(uploadedFile.path);
        res.json({ error: `[[error:invalid-image-type, ${allowedTypes.join('&#44; ')}]]` });
        return false;
    }
    return true;
}
function uploadImage(filename, folder, uploadedFile, req, res, next) {
    return __awaiter(this, void 0, void 0, function* () {
        let imageData;
        try {
            if (plugins.hooks.hasListeners('filter:uploadImage')) {
                imageData = yield plugins.hooks.fire('filter:uploadImage', { image: uploadedFile, uid: req.uid, folder: folder });
            }
            else {
                imageData = yield file.saveFileToLocal(filename, folder, uploadedFile.path);
            }
            if (path_1.default.basename(filename, path_1.default.extname(filename)) === 'site-logo' && folder === 'system') {
                const uploadPath = path_1.default.join(nconf_1.default.get('upload_path'), folder, 'site-logo-x50.png');
                yield image.resizeImage({
                    path: uploadedFile.path,
                    target: uploadPath,
                    height: 50,
                });
                yield meta_1.default.configs.set('brand:emailLogo', path_1.default.join(nconf_1.default.get('upload_url'), 'system/site-logo-x50.png'));
                const size = yield image.size(uploadedFile.path);
                yield meta_1.default.configs.setMultiple({
                    'brand:logo:width': size.width,
                    'brand:logo:height': size.height,
                });
            }
            else if (path_1.default.basename(filename, path_1.default.extname(filename)) === 'og:image' && folder === 'system') {
                const size = yield image.size(uploadedFile.path);
                yield meta_1.default.configs.setMultiple({
                    'og:image:width': size.width,
                    'og:image:height': size.height,
                });
            }
            res.json([{ name: uploadedFile.name, url: imageData.url.startsWith('http') ? imageData.url : nconf_1.default.get('relative_path') + imageData.url }]);
        }
        catch (err) {
            next(err);
        }
        finally {
            file.delete(uploadedFile.path);
        }
    });
}
