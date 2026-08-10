'use strict';

const meta = require('../meta');
const file = require('../file');

const multer = require('multer');
const storage = multer.diskStorage({});

// create middlware dynamically so maximumFileSize can be updated without restarting the server
function multerUpload() {
	return multer({
		storage,
		// from https://github.com/TriliumNext/Trilium/pull/3058/files
		fileFilter: (req, file, cb) => {
			// UTF-8 file names are not well decoded by multer/busboy, so we handle the conversion on our side.
			// See https://github.com/expressjs/multer/pull/1102.
			file.originalname = Buffer.from(file.originalname, 'latin1').toString('utf-8');
			cb(null, true);
		},
		limits: {
			fields: 20,
			files: 20,
			parts: 40,
			fileSize: meta.config.maximumFileSize * 1024,
			fieldNestingDepth: 3,
		},
	});
}

function withCleanup(middleware) {
	return (req, res, next) => {
		let cleaned = false;
		const cleanup = () => {
			if (cleaned) {
				return;
			}
			cleaned = true;
			deleteTempFiles(req.files || (req.file ? [req.file] : []));
		};

		res.once('finish', cleanup);
		res.once('close', cleanup);

		middleware(req, res, next);
	};
}

function dynamicUpload(method, ...args) {
	return withCleanup((req, res, next) => {
		multerUpload()[method](...args)(req, res, next);
	});
}

function deleteTempFiles(files) {
	if (Array.isArray(files)) {
		files.forEach(fileObj => file.delete(fileObj.path));
	}
}

module.exports = {
	array: (field, maxCount) => dynamicUpload('array', field, maxCount),
	single: field => dynamicUpload('single', field),
	fields: fields => dynamicUpload('fields', fields),
	none: () => dynamicUpload('none'),
	any: () => dynamicUpload('any'),
};


