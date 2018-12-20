'use strict';

var async = require('async');
var path = require('path');

var db = require('../database');
var image = require('../image');
var file = require('../file');

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

		async.waterfall([
			function (next) {
				if (tempPath) {
					return next(null, tempPath);
				}
				image.writeImageDataToTempFile(data.imageData, next);
			},
			function (_tempPath, next) {
				tempPath = _tempPath;

				const filename = 'groupCover-' + data.groupName + path.extname(tempPath);
				image.uploadImage(filename, 'files', {
					path: tempPath,
					uid: uid,
				}, next);
			},
			function (uploadData, next) {
				url = uploadData.url;
				Groups.setGroupField(data.groupName, 'cover:url', url, next);
			},
			function (next) {
				image.resizeImage({
					path: tempPath,
					width: 358,
				}, next);
			},
			function (next) {
				image.uploadImage('groupCoverThumb-' + data.groupName + path.extname(tempPath), 'files', {
					path: tempPath,
					uid: uid,
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

	Groups.removeCover = function (data, callback) {
		db.deleteObjectFields('group:' + data.groupName, ['cover:url', 'cover:thumb:url', 'cover:position'], callback);
	};
};
