'use strict';

var async = require('async');
var path = require('path');
var nconf = require('nconf');

var user = require('../../user');
var plugins = require('../../plugins');
var file = require('../../file');

module.exports = function (SocketUser) {
	SocketUser.changePicture = function (socket, data, callback) {
		if (!socket.uid) {
			return callback(new Error('[[error:invalid-uid]]'));
		}

		if (!data) {
			return callback(new Error('[[error:invalid-data]]'));
		}

		var type = data.type;

		async.waterfall([
			function (next) {
				user.isAdminOrGlobalModOrSelf(socket.uid, data.uid, next);
			},
			function (next) {
				switch (type) {
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
						picture: undefined,
					}, function (err, returnData) {
						next(err, returnData && returnData.picture);
					});
					break;
				}
			},
			function (picture, next) {
				user.setUserField(data.uid, 'picture', picture, next);
			},
		], callback);
	};

	SocketUser.removeUploadedPicture = function (socket, data, callback) {
		if (!socket.uid || !data || !data.uid) {
			return callback(new Error('[[error:invalid-data]]'));
		}

		async.waterfall([
			function (next) {
				user.isAdminOrSelf(socket.uid, data.uid, next);
			},
			function (next) {
				user.getUserFields(data.uid, ['uploadedpicture', 'picture'], next);
			},
			function (userData, next) {
				if (userData.uploadedpicture && !userData.uploadedpicture.startsWith('http')) {
					var pathToFile = path.join(nconf.get('base_dir'), 'public', userData.uploadedpicture);
					if (pathToFile.startsWith(nconf.get('upload_path'))) {
						file.delete(pathToFile);
					}
				}

				user.setUserFields(data.uid, {
					uploadedpicture: '',
					picture: userData.uploadedpicture === userData.picture ? '' : userData.picture,	// if current picture is uploaded picture, reset to user icon
				}, next);
			},
			function (next) {
				plugins.fireHook('action:user.removeUploadedPicture', { callerUid: socket.uid, uid: data.uid }, next);
			},
		], callback);
	};

	SocketUser.getProfilePictures = function (socket, data, callback) {
		if (!data || !data.uid) {
			return callback(new Error('[[error:invalid-data]]'));
		}
		async.waterfall([
			function (next) {
				async.parallel({
					list: async.apply(plugins.fireHook, 'filter:user.listPictures', {
						uid: data.uid,
						pictures: [],
					}),
					uploaded: async.apply(user.getUserField, data.uid, 'uploadedpicture'),
				}, next);
			},
			function (data, next) {
				if (data.uploaded) {
					data.list.pictures.push({
						type: 'uploaded',
						url: data.uploaded,
						text: '[[user:uploaded_picture]]',
					});
				}

				next(null, data.list.pictures);
			},
		], callback);
	};
};
