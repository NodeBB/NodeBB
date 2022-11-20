'use strict';

import path from 'path';import nconf from 'nconf';
const validator = require('validator');

import user from '../user';
import meta from '../meta';
import file from '../file';
import plugins from '../plugins';
const image = require('../image');
const privileges = require('../privileges');

import helpers from './helpers';

const uploadsController  = {} as any;

uploadsController.upload = async function (req, res, filesIterator) {
	let files;
	try {
		files = req.files.files;
	} catch (e: any) {
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
		const images : any[] = [];
		for (const fileObj of files) {
			/* eslint-disable no-await-in-loop */
			images.push(await filesIterator(fileObj));
		}

		helpers.formatApiResponse(200, res, { images });

		return images;
	} catch (err: any) {
		return helpers.formatApiResponse(500, res, err);
	} finally {
		deleteTempFiles(files);
	}
};

uploadsController.uploadPost = async function (req, res) {
	await uploadsController.upload(req, res, async (uploadedFile) => {
		const isImage = uploadedFile.type.match(/image./);
		if (isImage) {
			return await uploadAsImage(req, uploadedFile);
		}
		return await uploadAsFile(req, uploadedFile);
	});
};

async function uploadAsImage(req, uploadedFile) {
	const canUpload = await privileges.global.can('upload:post:image', req.uid);
	if (!canUpload) {
		throw new Error('[[error:no-privileges]]');
	}
	await image.checkDimensions(uploadedFile.path);
	await image.stripEXIF(uploadedFile.path);

	if (plugins.hooks.hasListeners('filter:uploadImage')) {
		return await plugins.hooks.fire('filter:uploadImage', {
			image: uploadedFile,
			uid: req.uid,
			folder: 'files',
		});
	}
	await image.isFileTypeAllowed(uploadedFile.path);

	let fileObj = await uploadsController.uploadFile(req.uid, uploadedFile);
	// sharp can't save svgs skip resize for them
	const isSVG = uploadedFile.type === 'image/svg+xml';
	if (isSVG || meta.configs.resizeImageWidth === 0 || meta.configs.resizeImageWidthThreshold === 0) {
		return fileObj;
	}

	fileObj = await resizeImage(fileObj);
	return { url: fileObj.url };
}

async function uploadAsFile(req, uploadedFile: string) {
	const canUpload = await privileges.global.can('upload:post:file', req.uid);
	if (!canUpload) {
		throw new Error('[[error:no-privileges]]');
	}

	const fileObj = await uploadsController.uploadFile(req.uid, uploadedFile);
	return {
		url: fileObj.url,
		name: fileObj.name,
	} as any;
}

async function resizeImage(fileObj) {
	const imageData = await image.size(fileObj.path);
	if (
		imageData.width < meta.configs.resizeImageWidthThreshold ||
		meta.configs.resizeImageWidth > meta.configs.resizeImageWidthThreshold
	) {
		return fileObj;
	}

	await image.resizeImage({
		path: fileObj.path,
		target: file.appendToFileName(fileObj.path, '-resized'),
		width: meta.configs.resizeImageWidth,
		quality: meta.configs.resizeImageQuality,
	});
	// Return the resized version to the composer/postData
	fileObj.url = file.appendToFileName(fileObj.url, '-resized');

	return fileObj;
}

uploadsController.uploadThumb = async function (req, res) {
	if (!meta.configs.allowTopicsThumbnail) {
		deleteTempFiles(req.files.files);
		return helpers.formatApiResponse(503, res, new Error('[[error:topic-thumbnails-are-disabled]]'));
	}

	return await uploadsController.upload(req, res, async (uploadedFile) => {
		if (!uploadedFile.type.match(/image./)) {
			throw new Error('[[error:invalid-file]]');
		}
		await image.isFileTypeAllowed(uploadedFile.path);
		const dimensions = await image.checkDimensions(uploadedFile.path);

		if (dimensions.width > parseInt(meta.configs.topicThumbSize, 10)) {
			await image.resizeImage({
				path: uploadedFile.path,
				width: meta.configs.topicThumbSize,
			});
		}
		if (plugins.hooks.hasListeners('filter:uploadImage')) {
			return await plugins.hooks.fire('filter:uploadImage', {
				image: uploadedFile,
				uid: req.uid,
				folder: 'files',
			});
		}

		return await uploadsController.uploadFile(req.uid, uploadedFile);
	});
};

uploadsController.uploadFile = async function (uid: string, uploadedFile) {
	if (plugins.hooks.hasListeners('filter:uploadFile')) {
		return await plugins.hooks.fire('filter:uploadFile', {
			file: uploadedFile,
			uid: uid,
			folder: 'files',
		});
	}

	if (!uploadedFile) {
		throw new Error('[[error:invalid-file]]');
	}

	if (uploadedFile.size > meta.configs.maximumFileSize * 1024) {
		throw new Error(`[[error:file-too-big, ${meta.configs.maximumFileSize}]]`);
	}

	const allowed = file.allowedExtensions();

	const extension = path.extname(uploadedFile.name).toLowerCase();
	if (allowed.length > 0 && (!extension || extension === '.' || !allowed.includes(extension))) {
		throw new Error(`[[error:invalid-file-type, ${allowed.join('&#44; ')}]]`);
	}

	return await saveFileToLocal(uid, 'files', uploadedFile);
};

async function saveFileToLocal(uid: string, folder, uploadedFile) {
	const name = uploadedFile.name || 'upload';
	const extension = path.extname(name) || '';

	const filename = `${Date.now()}-${validator.escape(name.slice(0, -extension.length)).slice(0, 255)}${extension}`;

	const upload = await file.saveFileToLocal(filename, folder, uploadedFile.path);
	const storedFile = {
		url: nconf.get('relative_path') + upload.url,
		path: upload.path,
		name: uploadedFile.name,
	} as any;

	await user.associateUpload(uid, upload.url.replace(`${nconf.get('upload_url')}/`, ''));
	const data = await plugins.hooks.fire('filter:uploadStored', { uid: uid, uploadedFile: uploadedFile, storedFile: storedFile });
	return data.storedFile;
}

function deleteTempFiles(files: Array<any>) {
	files.forEach(fileObj => file.delete(fileObj.path));
}

require('../promisify').promisify(uploadsController, ['upload', 'uploadPost', 'uploadThumb']);
