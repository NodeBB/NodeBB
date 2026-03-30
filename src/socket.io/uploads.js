'use strict';

const socketUser = require('./user');
const socketGroup = require('./groups');
const image = require('../image');
const meta = require('../meta');
const plugins = require('../plugins');

const inProgress = {};

const uploads = module.exports;

uploads.upload = async function (socket, data) {
	if (!socket.uid || !data || !data.chunk || !data.params || !data.params.method) {
		throw new Error('[[error:invalid-data]]');
	}
	const { method } = data.params;
	const defaultMaxSize = method === 'user.uploadCroppedPicture' ?
		meta.config.maximumProfileImageSize : meta.config.maximumCoverImageSize;

	const { methods, maxSize } = await plugins.hooks.fire('filter:uploads.upload', {
		methods: {
			'user.uploadCroppedPicture': socketUser.uploadCroppedPicture,
			'user.updateCover': socketUser.updateCover,
			'groups.cover.update': socketGroup.cover.update,
		},
		maxSize: defaultMaxSize,
		data: data,
	});

	if (!methods.hasOwnProperty(data.params.method)) {
		throw new Error('[[error:invalid-data]]');
	}

	inProgress[socket.id] = inProgress[socket.id] || Object.create(null);
	const socketUploads = inProgress[socket.id];

	socketUploads[method] = socketUploads[method] || { imageData: '' };
	socketUploads[method].imageData += data.chunk;

	try {
		const size = image.sizeFromBase64(socketUploads[method].imageData);

		if (size > maxSize * 1024) {
			throw new Error(`[[error:file-too-big, ${maxSize}]]`);
		}
		if (socketUploads[method].imageData.length < data.params.size) {
			return;
		}
		data.params.imageData = socketUploads[method].imageData;
		const result = await methods[method](socket, data.params);
		delete socketUploads[method];
		return result;
	} catch (err) {
		delete inProgress[socket.id];
		throw err;
	}
};

uploads.clear = function (sid) {
	delete inProgress[sid];
};
