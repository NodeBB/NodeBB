'use strict';

var async = require('async');
var nconf = require('nconf');
var path = require('path');
var fs = require('fs');
var crypto = require('crypto');
var Jimp = require('jimp');

var db = require('../database');
var file = require('../file');
var uploadsController = require('../controllers/uploads');

module.exports = function(Groups) {

	Groups.updateCoverPosition = function(groupName, position, callback) {
		if (!groupName) {
			return callback(new Error('[[error:invalid-data]]'));
		}
		Groups.setGroupField(groupName, 'cover:position', position, callback);
	};

	Groups.updateCover = function(uid, data, callback) {

		// Position only? That's fine
		if (!data.imageData && data.position) {
			return Groups.updateCoverPosition(data.groupName, data.position, callback);
		}

		var tempPath = data.file ? data.file : '';
		var url;

		async.waterfall([
			function (next) {
				if (tempPath) {
					return next(null, tempPath);
				}
				writeImageDataToFile(data.imageData, next);
			},
			function (_tempPath, next) {
				tempPath = _tempPath;
				uploadsController.uploadGroupCover(uid, {
					name: 'groupCover',
					path: tempPath
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
					name: 'groupCoverThumb',
					path: tempPath
				}, next);
			},
			function (uploadData, next) {
				Groups.setGroupField(data.groupName, 'cover:thumb:url', uploadData.url, next);
			},
			function (next){
				fs.unlink(tempPath, next);	// Delete temporary file
			}
		], function (err) {
			if (err) {
				return fs.unlink(tempPath, function(unlinkErr) {
					callback(err);	// send back original error
				});
			}

			if (data.position) {
				Groups.updateCoverPosition(data.groupName, data.position, function(err) {
					callback(err, {url: url});
				});
			} else {
				callback(err, {url: url});
			}
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
			}
		], function (err) {
			callback(err);
		});
	}

	function writeImageDataToFile(imageData, callback) {
		// Calculate md5sum of image
		// This is required because user data can be private
		var md5sum = crypto.createHash('md5');
		md5sum.update(imageData);
		md5sum = md5sum.digest('hex');

		// Save image
		var tempPath = path.join(nconf.get('base_dir'), nconf.get('upload_path'), md5sum);
		var buffer = new Buffer(imageData.slice(imageData.indexOf('base64') + 7), 'base64');

		fs.writeFile(tempPath, buffer, {
			encoding: 'base64'
		}, function(err) {
			callback(err, tempPath);
		});
	}

	Groups.removeCover = function(data, callback) {
		db.deleteObjectField('group:' + data.groupName, 'cover:url', callback);
	};

};