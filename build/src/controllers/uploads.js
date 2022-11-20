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
const path_1 = __importDefault(require("path"));
const nconf_1 = __importDefault(require("nconf"));
const validator = require('validator');
const user_1 = __importDefault(require("../user"));
const meta_1 = __importDefault(require("../meta"));
const file = require('../file');
const plugins = require('../plugins');
const image = require('../image');
const privileges = require('../privileges');
const helpers = require('./helpers').defualt;
const uploadsController = {};
uploadsController.upload = function (req, res, filesIterator) {
    return __awaiter(this, void 0, void 0, function* () {
        let files;
        try {
            files = req.files.files;
        }
        catch (e) {
            return helpers.formatApiResponse(400, res);
        }
        // These checks added because of odd behaviour by request: https://github.com/request/request/issues/2445
        if (!Array.isArray(files)) {
            return helpers.formatApiResponse(500, res, new Error('[[error:invalid-file]]'));
        }
        if (Array.isArray(files[0])) {
            files = files[0];
        }
        try {
            const images = [];
            for (const fileObj of files) {
                /* eslint-disable no-await-in-loop */
                images.push(yield filesIterator(fileObj));
            }
            helpers.formatApiResponse(200, res, { images });
            return images;
        }
        catch (err) {
            return helpers.formatApiResponse(500, res, err);
        }
        finally {
            deleteTempFiles(files);
        }
    });
};
uploadsController.uploadPost = function (req, res) {
    return __awaiter(this, void 0, void 0, function* () {
        yield uploadsController.upload(req, res, (uploadedFile) => __awaiter(this, void 0, void 0, function* () {
            const isImage = uploadedFile.type.match(/image./);
            if (isImage) {
                return yield uploadAsImage(req, uploadedFile);
            }
            return yield uploadAsFile(req, uploadedFile);
        }));
    });
};
function uploadAsImage(req, uploadedFile) {
    return __awaiter(this, void 0, void 0, function* () {
        const canUpload = yield privileges.global.can('upload:post:image', req.uid);
        if (!canUpload) {
            throw new Error('[[error:no-privileges]]');
        }
        yield image.checkDimensions(uploadedFile.path);
        yield image.stripEXIF(uploadedFile.path);
        if (plugins.hooks.hasListeners('filter:uploadImage')) {
            return yield plugins.hooks.fire('filter:uploadImage', {
                image: uploadedFile,
                uid: req.uid,
                folder: 'files',
            });
        }
        yield image.isFileTypeAllowed(uploadedFile.path);
        let fileObj = yield uploadsController.uploadFile(req.uid, uploadedFile);
        // sharp can't save svgs skip resize for them
        const isSVG = uploadedFile.type === 'image/svg+xml';
        if (isSVG || meta_1.default.config.resizeImageWidth === 0 || meta_1.default.config.resizeImageWidthThreshold === 0) {
            return fileObj;
        }
        fileObj = yield resizeImage(fileObj);
        return { url: fileObj.url };
    });
}
function uploadAsFile(req, uploadedFile) {
    return __awaiter(this, void 0, void 0, function* () {
        const canUpload = yield privileges.global.can('upload:post:file', req.uid);
        if (!canUpload) {
            throw new Error('[[error:no-privileges]]');
        }
        const fileObj = yield uploadsController.uploadFile(req.uid, uploadedFile);
        return {
            url: fileObj.url,
            name: fileObj.name,
        };
    });
}
function resizeImage(fileObj) {
    return __awaiter(this, void 0, void 0, function* () {
        const imageData = yield image.size(fileObj.path);
        if (imageData.width < meta_1.default.config.resizeImageWidthThreshold ||
            meta_1.default.config.resizeImageWidth > meta_1.default.config.resizeImageWidthThreshold) {
            return fileObj;
        }
        yield image.resizeImage({
            path: fileObj.path,
            target: file.appendToFileName(fileObj.path, '-resized'),
            width: meta_1.default.config.resizeImageWidth,
            quality: meta_1.default.config.resizeImageQuality,
        });
        // Return the resized version to the composer/postData
        fileObj.url = file.appendToFileName(fileObj.url, '-resized');
        return fileObj;
    });
}
uploadsController.uploadThumb = function (req, res) {
    return __awaiter(this, void 0, void 0, function* () {
        if (!meta_1.default.config.allowTopicsThumbnail) {
            deleteTempFiles(req.files.files);
            return helpers.formatApiResponse(503, res, new Error('[[error:topic-thumbnails-are-disabled]]'));
        }
        return yield uploadsController.upload(req, res, (uploadedFile) => __awaiter(this, void 0, void 0, function* () {
            if (!uploadedFile.type.match(/image./)) {
                throw new Error('[[error:invalid-file]]');
            }
            yield image.isFileTypeAllowed(uploadedFile.path);
            const dimensions = yield image.checkDimensions(uploadedFile.path);
            if (dimensions.width > parseInt(meta_1.default.config.topicThumbSize, 10)) {
                yield image.resizeImage({
                    path: uploadedFile.path,
                    width: meta_1.default.config.topicThumbSize,
                });
            }
            if (plugins.hooks.hasListeners('filter:uploadImage')) {
                return yield plugins.hooks.fire('filter:uploadImage', {
                    image: uploadedFile,
                    uid: req.uid,
                    folder: 'files',
                });
            }
            return yield uploadsController.uploadFile(req.uid, uploadedFile);
        }));
    });
};
uploadsController.uploadFile = function (uid, uploadedFile) {
    return __awaiter(this, void 0, void 0, function* () {
        if (plugins.hooks.hasListeners('filter:uploadFile')) {
            return yield plugins.hooks.fire('filter:uploadFile', {
                file: uploadedFile,
                uid: uid,
                folder: 'files',
            });
        }
        if (!uploadedFile) {
            throw new Error('[[error:invalid-file]]');
        }
        if (uploadedFile.size > meta_1.default.config.maximumFileSize * 1024) {
            throw new Error(`[[error:file-too-big, ${meta_1.default.config.maximumFileSize}]]`);
        }
        const allowed = file.allowedExtensions();
        const extension = path_1.default.extname(uploadedFile.name).toLowerCase();
        if (allowed.length > 0 && (!extension || extension === '.' || !allowed.includes(extension))) {
            throw new Error(`[[error:invalid-file-type, ${allowed.join('&#44; ')}]]`);
        }
        return yield saveFileToLocal(uid, 'files', uploadedFile);
    });
};
function saveFileToLocal(uid, folder, uploadedFile) {
    return __awaiter(this, void 0, void 0, function* () {
        const name = uploadedFile.name || 'upload';
        const extension = path_1.default.extname(name) || '';
        const filename = `${Date.now()}-${validator.escape(name.slice(0, -extension.length)).slice(0, 255)}${extension}`;
        const upload = yield file.saveFileToLocal(filename, folder, uploadedFile.path);
        const storedFile = {
            url: nconf_1.default.get('relative_path') + upload.url,
            path: upload.path,
            name: uploadedFile.name,
        };
        yield user_1.default.associateUpload(uid, upload.url.replace(`${nconf_1.default.get('upload_url')}/`, ''));
        const data = yield plugins.hooks.fire('filter:uploadStored', { uid: uid, uploadedFile: uploadedFile, storedFile: storedFile });
        return data.storedFile;
    });
}
function deleteTempFiles(files) {
    files.forEach(fileObj => file.delete(fileObj.path));
}
require('../promisify').promisify(uploadsController, ['upload', 'uploadPost', 'uploadThumb']);
