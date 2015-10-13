'use strict';

var async = require('async');
var winston = require('winston');

var user = require('../../user');

module.exports = function(SocketUser) {

	SocketUser.changePicture = function(socket, data, callback) {
		if (!socket.uid) {
			return callback('[[error:invalid-uid]]');
		}

		if (!data) {
			return callback(new Error('[[error:invalid-data]]'));
		}

		var type = data.type;

		if (type === 'gravatar') {
			type = 'gravatarpicture';
		} else if (type === 'uploaded') {
			type = 'uploadedpicture';
		} else {
			return callback(new Error('[[error:invalid-image-type, ' + ['gravatar', 'uploadedpicture'].join('&#44; ') + ']]'));
		}

		async.waterfall([
			function (next) {
				user.isAdminOrSelf(socket.uid, data.uid, next);
			},
			function (next) {
				user.getUserField(data.uid, type, next);
			},
			function (picture, next) {
				user.setUserField(data.uid, 'picture', picture, next);
			}
		], callback);
	};

	SocketUser.uploadProfileImageFromUrl = function(socket, data, callback) {
		if (!socket.uid || !data.url || !data.uid) {
			return;
		}

		user.isAdminOrSelf(socket.uid, data.uid, function(err) {
			if (err) {
				return callback(err);
			}
			user.uploadFromUrl(data.uid, data.url, function(err, uploadedImage) {
				callback(err, uploadedImage ? uploadedImage.url : null);
			});
		});
	};

	SocketUser.removeUploadedPicture = function(socket, data, callback) {
		if (!socket.uid || !data.uid) {
			return;
		}

		async.waterfall([
			function (next) {
				user.isAdminOrSelf(socket.uid, data.uid, next);
			},
			function (next) {
				user.getUserField(data.uid, 'uploadedpicture', next);
			},
			function(uploadedPicture, next) {
				if (!uploadedPicture.startsWith('http')) {
					require('fs').unlink(uploadedPicture, function(err) {
						if (err) {
							winston.error(err);
						}
					});
				}
				user.setUserField(data.uid, 'uploadedpicture', '', next);
			},
			function(next) {
				user.getUserField(data.uid, 'picture', next);
			}
		], callback);
	};
};