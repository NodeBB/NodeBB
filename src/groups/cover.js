'use strict';

var async = require('async');
var path = require('path');
var Jimp = require('jimp');
var mime = require('mime');

var db = require('../database');
var image = require('../image');
var file = require('../file');
var uploadsController = require('../controllers/uploads');

module.exports = function (Groups) {
	Groups.updateCoverPosition = function (groupName, position, callback) {
		if (!groupName) {
			return callback(new Error('[[error:invalid-data]]'));
		}
		Groups.setGroupField(groupName, 'cover:position', position, callback);
	};

	Groups.updateCover = function (uid, data, callback) {
		// Position only? That's fine
		if (!data.imageData && !data.file && data.position) {
			return Groups.updateCoverPosition(data.groupName, data.position, callback);
		}

		var tempPath = data.file ? data.file : '';
		var url;
		var type = data.file ? mime.getType(data.file) : 'image/png';

		async.waterfall([
			function (next) {
				if (tempPath) {
					return next(null, tempPath);
				}
				image.writeImageDataToTempFile(data.imageData, next);
			},
			function (_tempPath, next) {
				tempPath = _tempPath;

				uploadsController.uploadGroupCover(uid, {
					name: 'groupCover' + path.extname(tempPath),
					path: tempPath,
					type: type,
				}, next);
			},
			function (uploadData, next) {
				url = uploadData.url;
				Groups.setGroupField(data.groupName, 'cover:url', url, next);
			},
			function (next) {
				resizeCover(tempPath, next);
			},
			function (next) {
				uploadsController.uploadGroupCover(uid, {
					name: 'groupCoverThumb' + path.extname(tempPath),
					path: tempPath,
					type: type,
				}, next);
			},
			function (uploadData, next) {
				Groups.setGroupField(data.groupName, 'cover:thumb:url', uploadData.url, next);
			},
			function (next) {
				if (data.position) {
					Groups.updateCoverPosition(data.groupName, data.position, next);
				} else {
					next(null);
				}
			},
		], function (err) {
			file.delete(tempPath);
			callback(err, { url: url });
		});
	};

	function resizeCover(path, callback) {
		async.waterfall([
			function (next) {
				new Jimp(path, next);
			},
			function (image, next) {
				image.resize(358, Jimp.AUTO, next);
			},
			function (image, next) {
				image.write(path, next);
			},
		], function (err) {
			callback(err);
		});
	}

	Groups.removeCover = function (data, callback) {
		db.deleteObjectFields('group:' + data.groupName, ['cover:url', 'cover:thumb:url', 'cover:position'], callback);
	};
};
