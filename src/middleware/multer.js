'use strict';

const multer = require('multer');
const storage = multer.diskStorage({});
const upload = multer({
	storage,
	// from https://github.com/TriliumNext/Trilium/pull/3058/files
	fileFilter: (req, file, cb) => {
		// UTF-8 file names are not well decoded by multer/busboy, so we handle the conversion on our side.
		// See https://github.com/expressjs/multer/pull/1102.
		file.originalname = Buffer.from(file.originalname, 'latin1').toString('utf-8');
		cb(null, true);
	},
});

module.exports = upload;

