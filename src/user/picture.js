'use strict';

const winston = require('winston');
const mime = require('mime');

const db = require('../database');
const file = require('../file');
const image = require('../image');
const meta = require('../meta');
const plugins = require('../plugins');

module.exports = function (User) {
	User.getAllowedProfileImageExtensions = function () {
		return User.getAllowedImageTypes().map(type => mime.getExtension(type));
	};

	User.getAllowedImageTypes = function () {
		const allowedTypes = ['image/png', 'image/jpeg', 'image/bmp'];
		if (plugins.hasListeners('filter:image.isFileTypeAllowed')) {
			allowedTypes.push('image/gif');
		}
		return allowedTypes;
	};

	User.updateCoverPosition = async function (uid, position) {
		// Reject anything that isn't two percentages
		if (!/^[\d.]+%\s[\d.]+%$/.test(position)) {
			winston.warn('[user/updateCoverPosition] Invalid position received: ' + position);
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
			const filename = data.uid + '-profilecover' + extension;
			const uploadData = await image.uploadImage(filename, 'profile', picture);

			await User.setUserField(data.uid, 'cover:url', uploadData.url);

			if (data.position) {
				await User.updateCoverPosition(data.uid, data.position);
			}

			return {
				url: uploadData.url,
			};
		} finally {
			file.delete(picture.path);
		}
	};

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

			await User.setUserFields(data.uid, {
				uploadedpicture: uploadedImage.url,
				picture: uploadedImage.url,
			});
			return uploadedImage;
		} finally {
			file.delete(picture.path);
		}
	};

	function validateUpload(data, maxSize, allowedTypes) {
		if (!data.imageData) {
			throw new Error('[[error:invalid-data]]');
		}
		const size = image.sizeFromBase64(data.imageData);
		if (size > maxSize * 1024) {
			throw new Error('[[error:file-too-big, ' + maxSize + ']]');
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
		file.delete(path);
		return newPath;
	}

	function generateProfileImageFilename(uid, extension) {
		const keepAllVersions = meta.config['profile:keepAllUserImages'] === 1;
		const convertToPNG = meta.config['profile:convertProfileImageToPNG'] === 1;
		return uid + '-profileavatar' + (keepAllVersions ? '-' + Date.now() : '') + (convertToPNG ? '.png' : extension);
	}

	User.removeCoverPicture = async function (data) {
		await db.deleteObjectFields('user:' + data.uid, ['cover:url', 'cover:position']);
	};
};
