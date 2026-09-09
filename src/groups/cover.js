'use strict';

const path = require('path');

const nconf = require('nconf');
const { fileTypeFromFile } = require('file-type');

const db = require('../database');
const meta = require('../meta');
const image = require('../image');
const file = require('../file');

module.exports = function (Groups) {
	const allowedTypes = ['image/png', 'image/jpeg', 'image/bmp'];
	Groups.updateCoverPosition = async function (groupName, position) {
		if (!groupName) {
			throw new Error('[[error:invalid-data]]');
		}
		await Groups.setGroupField(groupName, 'cover:position', position);
	};

	Groups.updateCover = async function (uid, data) {
		let tempPath = data.file ? data.file.path : '';
		try {
			// Position only? That's fine
			if (!data.imageData && !data.file && data.position) {
				return await Groups.updateCoverPosition(data.groupName, data.position);
			}

			let type;
			if (tempPath) {
				const detected = await fileTypeFromFile(tempPath);
				if (!detected || !allowedTypes.includes(detected.mime)) {
					throw new Error('[[error:invalid-image]]');
				}
				type = detected.mime;
			} else {
				const imageData = await image.validateBase64(
					data.imageData, meta.config.maximumCoverImageSize, allowedTypes
				);
				tempPath = await image.writeImageDataToTempFile(imageData);
				type = imageData.mime;
			}

			await deleteCover(data.groupName);

			const filename = `groupCover-${data.groupName}-${Date.now()}${path.extname(tempPath)}`;
			const uploadData = await image.uploadImage(filename, 'files', {
				path: tempPath,
				uid: uid,
				name: 'groupCover',
			});

			await image.resizeImage({
				path: tempPath,
				type: type,
				width: 358,
			});
			const thumbFilename = `groupCoverThumb-${data.groupName}-${Date.now()}${path.extname(tempPath)}`;
			const thumbUploadData = await image.uploadImage(thumbFilename, 'files', {
				path: tempPath,
				uid: uid,
				name: 'groupCover',
			});

			await Groups.setGroupFields(data.groupName, {
				'cover:url': uploadData.url,
				'cover:thumb:url': thumbUploadData.url,
				...(data.position ? { 'cover:position': data.position } : {}),
			});

			return { url: uploadData.url };
		} finally {
			file.delete(tempPath);
		}
	};

	Groups.removeCover = async function (data) {
		await deleteCover(data.groupName);
		await db.deleteObjectFields(`group:${data.groupName}`, ['cover:url', 'cover:thumb:url', 'cover:position']);
	};

	async function deleteCover(groupName) {
		const fields = ['cover:url', 'cover:thumb:url'];
		const values = await Groups.getGroupFields(groupName, fields);
		await Promise.all(fields.map(async (field) => {
			if (!values[field] || !values[field].startsWith(`${nconf.get('relative_path')}/assets/uploads/files/`)) {
				return;
			}
			const filename = values[field].split('/').pop();
			const filePath = path.join(nconf.get('upload_path'), 'files', filename);
			if (file.isPathInside(nconf.get('upload_path'), filePath)) {
				await file.delete(filePath);
			}
		}));
	}
};
