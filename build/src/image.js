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
const os = require('os');
const fs = __importStar(require("fs"));
const path_1 = __importDefault(require("path"));
const crypto = require('crypto');
const winston_1 = __importDefault(require("winston"));
const file = require('./file');
const plugins = require('./plugins');
const meta = require('./meta');
const image = {};
function requireSharp() {
    const sharp = require('sharp');
    if (os.platform() === 'win32') {
        // https://github.com/lovell/sharp/issues/1259
        sharp.cache(false);
    }
    return sharp;
}
image.isFileTypeAllowed = function (path) {
    return __awaiter(this, void 0, void 0, function* () {
        const plugins = require('./plugins');
        if (plugins.hooks.hasListeners('filter:image.isFileTypeAllowed')) {
            return yield plugins.hooks.fire('filter:image.isFileTypeAllowed', path);
        }
        const sharp = require('sharp');
        yield sharp(path, {
            failOnError: true,
        }).metadata();
    });
};
image.resizeImage = function (data) {
    return __awaiter(this, void 0, void 0, function* () {
        if (plugins.hooks.hasListeners('filter:image.resize')) {
            yield plugins.hooks.fire('filter:image.resize', {
                path: data.path,
                target: data.target,
                width: data.width,
                height: data.height,
                quality: data.quality,
            });
        }
        else {
            const sharp = requireSharp();
            const buffer = yield fs.promises.readFile(data.path);
            const sharpImage = sharp(buffer, {
                failOnError: true,
                animated: data.path.endsWith('gif'),
            });
            const metadata = yield sharpImage.metadata();
            sharpImage.rotate(); // auto-orients based on exif data
            sharpImage.resize(data.hasOwnProperty('width') ? data.width : null, data.hasOwnProperty('height') ? data.height : null);
            if (data.quality) {
                switch (metadata.format) {
                    case 'jpeg': {
                        sharpImage.jpeg({
                            quality: data.quality,
                            mozjpeg: true,
                        });
                        break;
                    }
                    case 'png': {
                        sharpImage.png({
                            quality: data.quality,
                            compressionLevel: 9,
                        });
                        break;
                    }
                }
            }
            yield sharpImage.toFile(data.target || data.path);
        }
    });
};
image.normalise = function (path) {
    return __awaiter(this, void 0, void 0, function* () {
        if (plugins.hooks.hasListeners('filter:image.normalise')) {
            yield plugins.hooks.fire('filter:image.normalise', {
                path: path,
            });
        }
        else {
            const sharp = requireSharp();
            yield sharp(path, { failOnError: true }).png().toFile(`${path}.png`);
        }
        return `${path}.png`;
    });
};
image.size = function (path) {
    return __awaiter(this, void 0, void 0, function* () {
        let imageData;
        if (plugins.hooks.hasListeners('filter:image.size')) {
            imageData = yield plugins.hooks.fire('filter:image.size', {
                path: path,
            });
        }
        else {
            const sharp = requireSharp();
            imageData = yield sharp(path, { failOnError: true }).metadata();
        }
        return imageData ? { width: imageData.width, height: imageData.height } : undefined;
    });
};
image.stripEXIF = function (path) {
    return __awaiter(this, void 0, void 0, function* () {
        if (!meta.config.stripEXIFData || path.endsWith('.gif') || path.endsWith('.svg')) {
            return;
        }
        try {
            if (plugins.hooks.hasListeners('filter:image.stripEXIF')) {
                yield plugins.hooks.fire('filter:image.stripEXIF', {
                    path: path,
                });
                return;
            }
            const buffer = yield fs.promises.readFile(path);
            const sharp = requireSharp();
            yield sharp(buffer, { failOnError: true }).rotate().toFile(path);
        }
        catch (err) {
            winston_1.default.error(err.stack);
        }
    });
};
image.checkDimensions = function (path) {
    return __awaiter(this, void 0, void 0, function* () {
        const meta = require('./meta');
        const result = yield image.size(path);
        if (result.width > meta.config.rejectImageWidth || result.height > meta.config.rejectImageHeight) {
            throw new Error('[[error:invalid-image-dimensions]]');
        }
        return result;
    });
};
image.convertImageToBase64 = function (path) {
    return __awaiter(this, void 0, void 0, function* () {
        return yield fs.promises.readFile(path, 'base64');
    });
};
image.mimeFromBase64 = function (imageData) {
    return imageData.slice(5, imageData.indexOf('base64') - 1);
};
image.extensionFromBase64 = function (imageData) {
    return file.typeToExtension(image.mimeFromBase64(imageData));
};
image.writeImageDataToTempFile = function (imageData) {
    return __awaiter(this, void 0, void 0, function* () {
        const filename = crypto.createHash('md5').update(imageData).digest('hex');
        const type = image.mimeFromBase64(imageData);
        const extension = file.typeToExtension(type);
        const filepath = path_1.default.join(os.tmpdir(), filename + extension);
        const buffer = Buffer.from(imageData.slice(imageData.indexOf('base64') + 7), 'base64');
        yield fs.promises.writeFile(filepath, buffer, { encoding: 'base64' });
        return filepath;
    });
};
image.sizeFromBase64 = function (imageData) {
    return Buffer.from(imageData.slice(imageData.indexOf('base64') + 7), 'base64').length;
};
image.uploadImage = function (filename, folder, imageData) {
    return __awaiter(this, void 0, void 0, function* () {
        if (plugins.hooks.hasListeners('filter:uploadImage')) {
            return yield plugins.hooks.fire('filter:uploadImage', {
                image: imageData,
                uid: imageData.uid,
                folder: folder,
            });
        }
        yield image.isFileTypeAllowed(imageData.path);
        const upload = yield file.saveFileToLocal(filename, folder, imageData.path);
        return {
            url: upload.url,
            path: upload.path,
            name: imageData.name,
        };
    });
};
require('./promisify').promisify(image);
