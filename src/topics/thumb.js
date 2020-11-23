
'use strict';

var nconf = require('nconf');
var path = require('path');
var fs = require('fs');
var request = require('request');
var mime = require('mime');
var validator = require('validator');
var util = require('util');

var meta = require('../meta');
var image = require('../image');
var file = require('../file');
var plugins = require('../plugins');

module.exports = function (Topics) {
	const getHead = util.promisify(request.head);

	function pipeToFile(source, destination, callback) {
		request(source).pipe(fs.createWriteStream(destination)).on('close', callback);
	}
	const pipeToFileAsync = util.promisify(pipeToFile);

	Topics.resizeAndUploadThumb = async function (data) {
		// Only continue if passed in thumbnail exists and is a URL. A system path means an upload is not necessary.
		if (!data.thumb || !validator.isURL(data.thumb)) {
			return;
		}
		var pathToUpload;
		const res = await getHead(data.thumb);

		try {
			const type = res.headers['content-type'];
			if (!type.match(/image./)) {
				throw new Error('[[error:invalid-file]]');
			}

			var extension = path.extname(data.thumb);
			if (!extension) {
				extension = '.' + mime.getExtension(type);
			}
			const filename = Date.now() + '-topic-thumb' + extension;
			const folder = 'files';
			pathToUpload = path.join(nconf.get('upload_path'), folder, filename);

			await pipeToFileAsync(data.thumb, pathToUpload);

			await image.isFileTypeAllowed(pathToUpload);

			await image.checkDimensions(pathToUpload);
			await image.resizeImage({
				path: pathToUpload,
				width: meta.config.topicThumbSize,
				height: meta.config.topicThumbSize,
			});

			if (!plugins.hooks.hasListeners('filter:uploadImage')) {
				data.thumb = '/assets/uploads/' + folder + '/' + filename;
				return;
			}

			const uploadedFile = await plugins.hooks.fire('filter:uploadImage', {
				image: { path: pathToUpload, name: '' },
				uid: data.uid,
				folder: folder,
			});
			file.delete(pathToUpload);
			data.thumb = uploadedFile.url;
		} catch (err) {
			file.delete(pathToUpload);
			throw err;
		}
	};
};
