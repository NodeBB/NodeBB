'use strict';

const winston = require('winston');
const mime = require('mime');
const path = require('path');
const nconf = require('nconf');

const db = require('../database');
const file = require('../file');
const image = require('../image');
const meta = require('../meta');

module.exports = function (User) {
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
			const uploadData = await image.uploadImage(filename, `profile/uid-${data.uid}`, picture);

			if (!meta.config['profile:keepAllUserImages']) {
				await deletePicture(data.uid, 'cover:url');
			}

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

		return await storeUserUploadedPicture(data.callerUid, data.uid, {
			path: userPhoto.path,
			type: userPhoto.type,
			extension,
		});
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
			const type = image.mimeFromBase64(data.imageData);
			const extension = file.typeToExtension(type);
			if (!extension) {
				throw new Error('[[error:invalid-image-extension]]');
			}

			picture.path = await image.writeImageDataToTempFile(data.imageData);

			return await storeUserUploadedPicture(data.callerUid, data.uid, {
				path: picture.path,
				type,
				extension,
			});
		} finally {
			await file.delete(picture.path);
		}
	};

	async function storeUserUploadedPicture(callerUid, updateUid, picture) {
		const { type, extension } = picture;
		const normalizedPath = await convertToPNG(picture.path);
		const isNormalized = picture.path !== normalizedPath;

		await image.resizeImage({
			path: normalizedPath,
			type: isNormalized ? 'image/png' : type,
			width: meta.config.profileImageDimension,
			height: meta.config.profileImageDimension,
		});

		const filename = generateProfileImageFilename(updateUid, extension);
		const uploadedImage = await image.uploadImage(filename, `profile/uid-${updateUid}`, {
			uid: updateUid,
			path: picture.path,
			name: 'profileAvatar',
		});

		await User.updateProfile(callerUid, {
			uid: updateUid,
			uploadedpicture: uploadedImage.url,
			picture: uploadedImage.url,
		}, ['uploadedpicture', 'picture']);

		const zsetKey = `uid:${updateUid}:profile:pictures`;

		if (!meta.config['profile:keepAllUserImages']) {
			// if we are not keeping all images, only keep most recent 3
			const imagesToKeep = 3;
			const previousImages = await db.getSortedSetRevRangeWithScores(zsetKey, 0, -1);
			const toDeleteImages = previousImages.filter((imagePath, index) => index >= imagesToKeep - 1)
				.map(image => image.value);
			const toRemove = [
				...toDeleteImages.map(imagePath => ([zsetKey, imagePath])),
			];

			await db.sortedSetRemoveBulk(toRemove);
			toDeleteImages.forEach((imagePath) => {
				if (imagePath && !imagePath.startsWith('http')) {
					file.delete(imagePath);
				}
			});
		}
		await db.sortedSetAdd(zsetKey, Date.now(), uploadedImage.url);
		return uploadedImage;
	}

	async function deletePicture(uid, field) {
		const uploadPath = await getPicturePathFromUserField(uid, field);
		if (uploadPath) {
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
		await deletePicture(data.uid, 'cover:url');
		await db.deleteObjectFields(`user:${data.uid}`, ['cover:url', 'cover:position']);
	};

	User.isUserUploadedPicture = async (uid, picture) => {
		return await db.isSortedSetMember(`uid:${uid}:profile:pictures`, picture);
	};

	User.removeProfileImage = async function (uid, picture) {
		const userData = await User.getUserFields(uid, ['uploadedpicture', 'picture']);
		const isUserPicture = await User.isUserUploadedPicture(uid, picture);
		if (isUserPicture) {
			const path = getPicturePath(uid, picture);
			await Promise.all([
				!path.startsWith('http') ? file.delete(path) : null,
				db.sortedSetRemove(`uid:${uid}:profile:pictures`, picture),
			]);
			if (picture === userData.picture) {
				// if deleting current uploaded picture, reset to user icon
				await User.setUserFields(uid, {
					uploadedpicture: '',
					picture: '',
				});
			}
		}

		return userData;
	};

	User.getLocalCoverPath = async function (uid) {
		return getPicturePathFromUserField(uid, 'cover:url');
	};

	User.getLocalAvatarPath = async function (uid) {
		return getPicturePathFromUserField(uid, 'uploadedpicture');
	};

	async function getPicturePathFromUserField(uid, field) {
		const value = await User.getUserField(uid, field);
		return getPicturePath(uid, value);
	}

	function getPicturePath(uid, value) {
		if (!value || !value.startsWith(`${nconf.get('relative_path')}/assets/uploads/profile/uid-${uid}`)) {
			return false;
		}
		const filename = value.split('/').pop();
		return path.join(nconf.get('upload_path'), `profile/uid-${uid}`, filename);
	}

};
