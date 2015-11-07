'use strict';

var async = require('async');
var winston = require('winston');

var user = require('../../user');
var plugins = require('../../plugins');

module.exports = function(SocketUser) {

	SocketUser.changePicture = function(socket, data, callback) {
		if (!socket.uid) {
			return callback('[[error:invalid-uid]]');
		}

		if (!data) {
			return callback(new Error('[[error:invalid-data]]'));
		}

		var type = data.type;

		async.waterfall([
			function (next) {
				user.isAdminOrSelf(socket.uid, data.uid, next);
			},
			function (next) {
				switch(type) {
					case 'default':
						next(null, '');
						break;
					case 'uploaded':
						user.getUserField(data.uid, 'uploadedpicture', next);
						break;
					default:
						plugins.fireHook('filter:user.getPicture', {
							uid: socket.uid,
							type: type,
							picture: undefined
						}, function(err, returnData) {
							next(null, returnData.picture || '');
						});
						break;
				}
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

	SocketUser.getProfilePictures = function(socket, data, callback) {
		if (!data || !data.uid) {
			return callback(new Error('[[error:invalid-data]]'));
		}

		async.parallel({
			list: async.apply(plugins.fireHook, 'filter:user.listPictures', {
				uid: data.uid,
				pictures: []
			}),
			uploaded: async.apply(user.getUserField, data.uid, 'uploadedpicture')
		}, function(err, data) {
			if (err) {
				return callback(err);
			}

			if (data.uploaded) {
				data.list.pictures.push({
					type: 'uploaded',
					url: data.uploaded,
					text: '[[user:uploaded_picture]]'
				});
			}

			callback(null, data.list.pictures);
		})
	};
};