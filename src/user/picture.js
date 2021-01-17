'use strict';

const winston = require('winston');
const mime = require('mime');
const path = require('path');
const nconf = require('nconf');

const db = require('../database');
const file = require('../file');
const image = require('../image');
const meta = require('../meta');
const plugins = require('../plugins');

module.exports = function (User) {
	User.getAllowedProfileImageExtensions = function () {
		const exts = User.getAllowedImageTypes().map(type => mime.getExtension(type));
		if (exts.includes('jpeg')) {
			exts.push('jpg');
		}
		return exts;
	};

	User.getAllowedImageTypes = function () {
		const allowedTypes = ['image/png', 'image/jpeg', 'image/bmp'];
		if (plugins.hooks.hasListeners('filter:image.isFileTypeAllowed')) {
			allowedTypes.push('image/gif');
		}
		return allowedTypes;
	};

	User.updateCoverPosition = async function (uid, position) {
		// Reject anything that isn't two percentages
		if (!/^[\d.]+%\s[\d.]+%$/.test(position)) {
			winston.warn(`[user/updateCoverPosition] Invalid position received: ${position}`);
			throw new Error('[[error:invalid-data]]');
		}

		await User.setUserField(uid, 'cover:position', position);
	};

	User.updateCoverPicture = async function (data) {
		const picture = {
			name: 'profileCover',
			uid: data.uid,
		};

		try {
			if (!data.imageData && data.position) {
				return await User.updateCoverPosition(data.uid, data.position);
			}

			validateUpload(data, meta.config.maximumCoverImageSize, ['image/png', 'image/jpeg', 'image/bmp']);

			picture.path = await image.writeImageDataToTempFile(data.imageData);

			const extension = file.typeToExtension(image.mimeFromBase64(data.imageData));
			const filename = `${data.uid}-profilecover-${Date.now()}${extension}`;
			const uploadData = await image.uploadImage(filename, 'profile', picture);

			await deleteCurrentPicture(data.uid, 'cover:url');
			await User.setUserField(data.uid, 'cover:url', uploadData.url);

			if (data.position) {
				await User.updateCoverPosition(data.uid, data.position);
			}

			return {
				url: uploadData.url,
			};
		} finally {
			await file.delete(picture.path);
		}
	};

	// uploads a image file as profile picture
	User.uploadCroppedPictureFile = async function (data) {
		const userPhoto = data.file;
		if (!meta.config.allowProfileImageUploads) {
			throw new Error('[[error:profile-image-uploads-disabled]]');
		}

		if (userPhoto.size > meta.config.maximumProfileImageSize * 1024) {
			throw new Error(`[[error:file-too-big, ${meta.config.maximumProfileImageSize}]]`);
		}

		if (!userPhoto.type || !User.getAllowedImageTypes().includes(userPhoto.type)) {
			throw new Error('[[error:invalid-image]]');
		}

		const extension = file.typeToExtension(userPhoto.type);
		if (!extension) {
			throw new Error('[[error:invalid-image-extension]]');
		}

		const newPath = await convertToPNG(userPhoto.path);

		await image.resizeImage({
			path: newPath,
			width: meta.config.profileImageDimension,
			height: meta.config.profileImageDimension,
		});

		const filename = generateProfileImageFilename(data.uid, extension);
		const uploadedImage = await image.uploadImage(filename, 'profile', {
			uid: data.uid,
			path: newPath,
			name: 'profileAvatar',
		});

		await deleteCurrentPicture(data.uid, 'uploadedpicture');
		await User.setUserFields(data.uid, {
			uploadedpicture: uploadedImage.url,
			picture: uploadedImage.url,
		});
		return uploadedImage;
	};

	// uploads image data in base64 as profile picture
	User.uploadCroppedPicture = async function (data) {
		const picture = {
			name: 'profileAvatar',
			uid: data.uid,
		};

		try {
			if (!meta.config.allowProfileImageUploads) {
				throw new Error('[[error:profile-image-uploads-disabled]]');
			}

			validateUpload(data, meta.config.maximumProfileImageSize, User.getAllowedImageTypes());

			const extension = file.typeToExtension(image.mimeFromBase64(data.imageData));
			if (!extension) {
				throw new Error('[[error:invalid-image-extension]]');
			}

			picture.path = await image.writeImageDataToTempFile(data.imageData);
			picture.path = await convertToPNG(picture.path);

			await image.resizeImage({
				path: picture.path,
				width: meta.config.profileImageDimension,
				height: meta.config.profileImageDimension,
			});

			const filename = generateProfileImageFilename(data.uid, extension);
			const uploadedImage = await image.uploadImage(filename, 'profile', picture);

			await deleteCurrentPicture(data.uid, 'uploadedpicture');
			await User.setUserFields(data.uid, {
				uploadedpicture: uploadedImage.url,
				picture: uploadedImage.url,
			});
			return uploadedImage;
		} finally {
			await file.delete(picture.path);
		}
	};

	async function deleteCurrentPicture(uid, field) {
		if (meta.config['profile:keepAllUserImages']) {
			return;
		}
		const value = await User.getUserField(uid, field);
		if (value && value.startsWith('/assets/uploads/profile/')) {
			const filename = value.split('/').pop();
			const uploadPath = path.join(nconf.get('upload_path'), 'profile', filename);
			await file.delete(uploadPath);
		}
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

	async function convertToPNG(path) {
		const convertToPNG = meta.config['profile:convertProfileImageToPNG'] === 1;
		if (!convertToPNG) {
			return path;
		}
		const newPath = await image.normalise(path);
		await file.delete(path);
		return newPath;
	}

	function generateProfileImageFilename(uid, extension) {
		const convertToPNG = meta.config['profile:convertProfileImageToPNG'] === 1;
		return `${uid}-profileavatar-${Date.now()}${convertToPNG ? '.png' : extension}`;
	}

	User.removeCoverPicture = async function (data) {
		await db.deleteObjectFields(`user:${data.uid}`, ['cover:url', 'cover:position']);
	};
};
