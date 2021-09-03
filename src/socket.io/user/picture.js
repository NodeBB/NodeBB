'use strict';

const user = require('../../user');
const plugins = require('../../plugins');

const websockets = require('../index');
const api = require('../../api');

module.exports = function (SocketUser) {
	SocketUser.changePicture = async function (socket, data) {
		websockets.warnDeprecated(socket, 'PUT /api/v3/users/:uid/picture');
		await api.users.changePicture(socket, data);
	};

	SocketUser.removeUploadedPicture = async function (socket, data) {
		if (!socket.uid || !data || !data.uid) {
			throw new Error('[[error:invalid-data]]');
		}
		await user.isAdminOrSelf(socket.uid, data.uid);
		// 'keepAllUserImages' is ignored, since there is explicit user intent
		const userData = await user.removeProfileImage(data.uid);
		plugins.hooks.fire('action:user.removeUploadedPicture', {
			callerUid: socket.uid,
			uid: data.uid,
			user: userData,
		});
	};

	SocketUser.getProfilePictures = async function (socket, data) {
		if (!data || !data.uid) {
			throw new Error('[[error:invalid-data]]');
		}

		const [list, uploaded] = await Promise.all([
			plugins.hooks.fire('filter:user.listPictures', {
				uid: data.uid,
				pictures: [],
			}),
			user.getUserField(data.uid, 'uploadedpicture'),
		]);

		if (uploaded) {
			list.pictures.push({
				type: 'uploaded',
				url: uploaded,
				text: '[[user:uploaded_picture]]',
			});
		}

		return list.pictures;
	};
};
