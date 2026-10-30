'use strict';

const os = require('os');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const winston = require('winston');
const { fileTypeFromBuffer } = require('file-type');

const file = require('./file');
const plugins = require('./plugins');
const meta = require('./meta');

const image = module.exports;

function requireSharp() {
	const sharp = require('sharp');
	if (os.platform() === 'win32') {
		// https://github.com/lovell/sharp/issues/1259
		sharp.cache(false);
	}
	return sharp;
}

image.isFileTypeAllowed = async function (path) {
	const plugins = require('./plugins');
	if (plugins.hooks.hasListeners('filter:image.isFileTypeAllowed')) {
		return await plugins.hooks.fire('filter:image.isFileTypeAllowed', path);
	}
	const sharp = require('sharp');
	await sharp(path, {
		failOn: 'error',
	}).metadata();
};

image.resizeImage = async function (data) {
	if (plugins.hooks.hasListeners('filter:image.resize')) {
		await plugins.hooks.fire('filter:image.resize', {
			path: data.path,
			target: data.target,
			width: data.width,
			height: data.height,
			quality: data.quality,
			type: data.type,
		});
	} else {
		const sharp = requireSharp();
		const buffer = await fs.promises.readFile(data.path);
		const sharpImage = sharp(buffer, {
			failOn: 'error',
			animated: data.type === 'image/gif',
		});
		const metadata = await sharpImage.metadata();

		sharpImage.rotate(); // auto-orients based on exif data
		// don't resize if width/height not changing or not specificied
		if ((data.width && metadata.width !== data.width) || (data.height && metadata.height !== data.height)) {
			sharpImage.resize(data.width || null, data.height || null);
		}

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

		await sharpImage.toFile(data.target || data.path);
	}
};

image.normalise = async function (path) {
	if (plugins.hooks.hasListeners('filter:image.normalise')) {
		await plugins.hooks.fire('filter:image.normalise', {
			path: path,
		});
	} else {
		const sharp = requireSharp();
		await sharp(path, { failOn: 'error' }).png().toFile(`${path}.png`);
	}
	return `${path}.png`;
};

image.size = async function (path) {
	let imageData;
	if (plugins.hooks.hasListeners('filter:image.size')) {
		imageData = await plugins.hooks.fire('filter:image.size', {
			path: path,
		});
	} else {
		const sharp = requireSharp();
		imageData = await sharp(path, { failOn: 'error' }).metadata();
	}
	return imageData ? { width: imageData.width, height: imageData.height } : undefined;
};

image.stripEXIF = async function ({ path, type }) {
	if (!meta.config.stripEXIFData || type === 'image/gif' || type === 'image/svg+xml') {
		return;
	}
	try {
		if (plugins.hooks.hasListeners('filter:image.stripEXIF')) {
			await plugins.hooks.fire('filter:image.stripEXIF', {
				path: path,
				type: type,
			});
			return;
		}
		const buffer = await fs.promises.readFile(path);
		const sharp = requireSharp();
		await sharp(buffer, { failOn: 'error', pages: -1 }).rotate().toFile(path);
	} catch (err) {
		winston.error(err.stack);
	}
};

image.checkDimensions = async function (path) {
	const result = await image.size(path);

	if (result.width > meta.config.rejectImageWidth || result.height > meta.config.rejectImageHeight) {
		throw new Error('[[error:invalid-image-dimensions]]');
	}

	return result;
};

image.convertImageToBase64 = async function (path) {
	return await fs.promises.readFile(path, 'base64');
};

image.validateBase64 = async function (imageData, maxSize, allowedTypes) {
	if (!imageData) {
		throw new Error('[[error:invalid-data]]');
	}

	const match = /^data:[^;,]+;base64,(.+)$/.exec(imageData);
	if (!match) {
		throw new Error('[[error:invalid-data]]');
	}
	const buffer = Buffer.from(match[1], 'base64');

	if (buffer.length > maxSize * 1024) {
		throw new Error(`[[error:file-too-big, ${maxSize}]]`);
	}

	const detected = await fileTypeFromBuffer(buffer);
	if (!detected || !allowedTypes.includes(detected.mime)) {
		throw new Error('[[error:invalid-image]]');
	}

	return { buffer, mime: detected.mime, extension: `.${detected.ext}` };
};

image.writeImageDataToTempFile = async function (imageData) {
	const filename = crypto.createHash('md5').update(imageData.buffer).digest('hex');
	const filepath = path.join(os.tmpdir(), filename + imageData.extension);
	await fs.promises.writeFile(filepath, imageData.buffer, { encoding: 'base64' });
	return filepath;
};

image.sizeFromBase64 = function (imageData) {
	return Buffer.from(imageData.slice(imageData.indexOf('base64') + 7), 'base64').length;
};

image.uploadImage = async function (filename, folder, imageData) {
	if (plugins.hooks.hasListeners('filter:uploadImage')) {
		return await plugins.hooks.fire('filter:uploadImage', {
			image: imageData,
			uid: imageData.uid,
			folder: folder,
		});
	}
	await image.isFileTypeAllowed(imageData.path);
	const upload = await file.saveFileToLocal(filename, folder, imageData.path);
	return {
		url: upload.url,
		path: upload.path,
		name: imageData.name,
	};
};

require('./promisify')(image);
