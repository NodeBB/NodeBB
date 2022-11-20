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
const winston_1 = __importDefault(require("winston"));
const mime = require('mime');
const path_1 = __importDefault(require("path"));
const nconf_1 = __importDefault(require("nconf"));
const database_1 = __importDefault(require("../database"));
const file = require('../file');
const image = require('../image');
const meta_1 = __importDefault(require("../meta"));
function default_1(User) {
    User.getAllowedProfileImageExtensions = function () {
        const exts = User.getAllowedImageTypes().map(type => mime.getExtension(type));
        if (exts.includes('jpeg')) {
            exts.push('jpg');
        }
        return exts;
    };
    User.getAllowedImageTypes = function () {
        return ['image/png', 'image/jpeg', 'image/bmp', 'image/gif'];
    };
    User.updateCoverPosition = function (uid, position) {
        return __awaiter(this, void 0, void 0, function* () {
            // Reject anything that isn't two percentages
            if (!/^[\d.]+%\s[\d.]+%$/.test(position)) {
                winston_1.default.warn(`[user/updateCoverPosition] Invalid position received: ${position}`);
                throw new Error('[[error:invalid-data]]');
            }
            yield User.setUserField(uid, 'cover:position', position);
        });
    };
    User.updateCoverPicture = function (data) {
        return __awaiter(this, void 0, void 0, function* () {
            const picture = {
                name: 'profileCover',
                uid: data.uid,
            };
            try {
                if (!data.imageData && data.position) {
                    return yield User.updateCoverPosition(data.uid, data.position);
                }
                validateUpload(data, meta_1.default.config.maximumCoverImageSize, ['image/png', 'image/jpeg', 'image/bmp']);
                picture.path = yield image.writeImageDataToTempFile(data.imageData);
                const extension = file.typeToExtension(image.mimeFromBase64(data.imageData));
                const filename = `${data.uid}-profilecover-${Date.now()}${extension}`;
                const uploadData = yield image.uploadImage(filename, 'profile', picture);
                yield deleteCurrentPicture(data.uid, 'cover:url');
                yield User.setUserField(data.uid, 'cover:url', uploadData.url);
                if (data.position) {
                    yield User.updateCoverPosition(data.uid, data.position);
                }
                return {
                    url: uploadData.url,
                };
            }
            finally {
                yield file.delete(picture.path);
            }
        });
    };
    // uploads a image file as profile picture
    User.uploadCroppedPictureFile = function (data) {
        return __awaiter(this, void 0, void 0, function* () {
            const userPhoto = data.file;
            if (!meta_1.default.config.allowProfileImageUploads) {
                throw new Error('[[error:profile-image-uploads-disabled]]');
            }
            if (userPhoto.size > meta_1.default.config.maximumProfileImageSize * 1024) {
                throw new Error(`[[error:file-too-big, ${meta_1.default.config.maximumProfileImageSize}]]`);
            }
            if (!userPhoto.type || !User.getAllowedImageTypes().includes(userPhoto.type)) {
                throw new Error('[[error:invalid-image]]');
            }
            const extension = file.typeToExtension(userPhoto.type);
            if (!extension) {
                throw new Error('[[error:invalid-image-extension]]');
            }
            const newPath = yield convertToPNG(userPhoto.path);
            yield image.resizeImage({
                path: newPath,
                width: meta_1.default.config.profileImageDimension,
                height: meta_1.default.config.profileImageDimension,
            });
            const filename = generateProfileImageFilename(data.uid, extension);
            const uploadedImage = yield image.uploadImage(filename, 'profile', {
                uid: data.uid,
                path: newPath,
                name: 'profileAvatar',
            });
            yield deleteCurrentPicture(data.uid, 'uploadedpicture');
            yield User.updateProfile(data.callerUid, {
                uid: data.uid,
                uploadedpicture: uploadedImage.url,
                picture: uploadedImage.url,
            }, ['uploadedpicture', 'picture']);
            return uploadedImage;
        });
    };
    // uploads image data in base64 as profile picture
    User.uploadCroppedPicture = function (data) {
        return __awaiter(this, void 0, void 0, function* () {
            const picture = {
                name: 'profileAvatar',
                uid: data.uid,
            };
            try {
                if (!meta_1.default.config.allowProfileImageUploads) {
                    throw new Error('[[error:profile-image-uploads-disabled]]');
                }
                validateUpload(data, meta_1.default.config.maximumProfileImageSize, User.getAllowedImageTypes());
                const extension = file.typeToExtension(image.mimeFromBase64(data.imageData));
                if (!extension) {
                    throw new Error('[[error:invalid-image-extension]]');
                }
                picture.path = yield image.writeImageDataToTempFile(data.imageData);
                picture.path = yield convertToPNG(picture.path);
                yield image.resizeImage({
                    path: picture.path,
                    width: meta_1.default.config.profileImageDimension,
                    height: meta_1.default.config.profileImageDimension,
                });
                const filename = generateProfileImageFilename(data.uid, extension);
                const uploadedImage = yield image.uploadImage(filename, 'profile', picture);
                yield deleteCurrentPicture(data.uid, 'uploadedpicture');
                yield User.updateProfile(data.callerUid, {
                    uid: data.uid,
                    uploadedpicture: uploadedImage.url,
                    picture: uploadedImage.url,
                }, ['uploadedpicture', 'picture']);
                return uploadedImage;
            }
            finally {
                yield file.delete(picture.path);
            }
        });
    };
    function deleteCurrentPicture(uid, field) {
        return __awaiter(this, void 0, void 0, function* () {
            if (meta_1.default.config['profile:keepAllUserImages']) {
                return;
            }
            yield deletePicture(uid, field);
        });
    }
    function deletePicture(uid, field) {
        return __awaiter(this, void 0, void 0, function* () {
            const uploadPath = yield getPicturePath(uid, field);
            if (uploadPath) {
                yield file.delete(uploadPath);
            }
        });
    }
    function validateUpload(data, maxSize, allowedTypes) {
        if (!data.imageData) {
            throw new Error('[[error:invalid-data]]');
        }
        const size = image.sizeFromBase64(data.imageData);
        if (size > maxSize * 1024) {
            throw new Error(`[[error:file-too-big, ${maxSize}]]`);
        }
        const type = image.mimeFromBase64(data.imageData);
        if (!type || !allowedTypes.includes(type)) {
            throw new Error('[[error:invalid-image]]');
        }
    }
    function convertToPNG(path) {
        return __awaiter(this, void 0, void 0, function* () {
            const convertToPNG = meta_1.default.config['profile:convertProfileImageToPNG'] === 1;
            if (!convertToPNG) {
                return path;
            }
            const newPath = yield image.normalise(path);
            yield file.delete(path);
            return newPath;
        });
    }
    function generateProfileImageFilename(uid, extension) {
        const convertToPNG = meta_1.default.config['profile:convertProfileImageToPNG'] === 1;
        return `${uid}-profileavatar-${Date.now()}${convertToPNG ? '.png' : extension}`;
    }
    User.removeCoverPicture = function (data) {
        return __awaiter(this, void 0, void 0, function* () {
            yield deletePicture(data.uid, 'cover:url');
            yield database_1.default.deleteObjectFields(`user:${data.uid}`, ['cover:url', 'cover:position']);
        });
    };
    User.removeProfileImage = function (uid) {
        return __awaiter(this, void 0, void 0, function* () {
            const userData = yield User.getUserFields(uid, ['uploadedpicture', 'picture']);
            yield deletePicture(uid, 'uploadedpicture');
            yield User.setUserFields(uid, {
                uploadedpicture: '',
                // if current picture is uploaded picture, reset to user icon
                picture: userData.uploadedpicture === userData.picture ? '' : userData.picture,
            });
            return userData;
        });
    };
    User.getLocalCoverPath = function (uid) {
        return __awaiter(this, void 0, void 0, function* () {
            return getPicturePath(uid, 'cover:url');
        });
    };
    User.getLocalAvatarPath = function (uid) {
        return __awaiter(this, void 0, void 0, function* () {
            return getPicturePath(uid, 'uploadedpicture');
        });
    };
    function getPicturePath(uid, field) {
        return __awaiter(this, void 0, void 0, function* () {
            const value = yield User.getUserField(uid, field);
            if (!value || !value.startsWith(`${nconf_1.default.get('relative_path')}/assets/uploads/profile/`)) {
                return false;
            }
            const filename = value.split('/').pop();
            return path_1.default.join(nconf_1.default.get('upload_path'), 'profile', filename);
        });
    }
}
exports.default = default_1;
;
