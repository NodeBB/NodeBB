'use strict';

var winston = require('winston');

var file = require('../file');
var image = require('../image');
var meta = require('../meta');
var db = require('../database');

module.exports = function (User) {
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

			if (!data.imageData && !data.file) {
				throw new Error('[[error:invalid-data]]');
			}
			const size = data.file ? data.file.size : image.sizeFromBase64(data.imageData);
			if (size > meta.config.maximumCoverImageSize * 1024) {
				throw new Error('[[error:file-too-big, ' + meta.config.maximumCoverImageSize + ']]');
			}

			if (data.file) {
				picture.path = data.file.path;
			} else {
				picture.path = await image.writeImageDataToTempFile(data.imageData);
			}

			const type = data.file ? data.file.type : image.mimeFromBase64(data.imageData);
			if (!type || !type.match(/^image./)) {
				throw new Error('[[error:invalid-image]]');
			}

			const extension = file.typeToExtension(type);
			const filename = generateProfileImageFilename(data.uid, 'profilecover', extension);
			const uploadData = await image.uploadImage(filename, 'profile', picture);

			await User.setUserField(data.uid, 'cover:url', uploadData.url);

			if (data.position) {
				await User.updateCoverPosition(data.uid, data.position);
			}

			return {
				url: uploadData.url,
			};
		} finally {
			file.delete(picture.path || (data.file && data.file.path));
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

			if (!data.imageData && !data.file) {
				throw new Error('[[error:invalid-data]]');
			}

			const size = data.file ? data.file.size : image.sizeFromBase64(data.imageData);
			const uploadSize = meta.config.maximumProfileImageSize;
			if (size > uploadSize * 1024) {
				throw new Error('[[error:file-too-big, ' + uploadSize + ']]');
			}

			const type = data.file ? data.file.type : image.mimeFromBase64(data.imageData);
			if (!type || !type.match(/^image./)) {
				throw new Error('[[error:invalid-image]]');
			}
			const extension = file.typeToExtension(type);
			if (!extension) {
				throw new Error('[[error:invalid-image-extension]]');
			}

			if (data.file) {
				picture.path = data.file.path;
			} else {
				picture.path = await image.writeImageDataToTempFile(data.imageData);
			}

			picture.path = await convertToPNG(picture.path, extension);

			await image.resizeImage({
				path: picture.path,
				width: meta.config.profileImageDimension,
				height: meta.config.profileImageDimension,
			});

			const filename = generateProfileImageFilename(data.uid, 'profileavatar', extension);
			const uploadedImage = await image.uploadImage(filename, 'profile', picture);

			await User.setUserFields(data.uid, {
				uploadedpicture: uploadedImage.url,
				picture: uploadedImage.url,
			});
			return uploadedImage;
		} finally {
			file.delete(picture.path || (data.file && data.file.path));
		}
	};

	async function convertToPNG(path, extension) {
		var convertToPNG = meta.config['profile:convertProfileImageToPNG'] === 1;
		if (!convertToPNG) {
			return path;
		}
		const newPath = await image.normalise(path, extension);
		file.delete(path);
		return newPath;
	}

	function generateProfileImageFilename(uid, type, extension) {
		var keepAllVersions = meta.config['profile:keepAllUserImages'] === 1;
		var convertToPNG = meta.config['profile:convertProfileImageToPNG'] === 1;
		return uid + '-' + type + (keepAllVersions ? '-' + Date.now() : '') + (convertToPNG ? '.png' : extension);
	}

	User.removeCoverPicture = async function (data) {
		await db.deleteObjectFields('user:' + data.uid, ['cover:url', 'cover:position']);
	};
};
