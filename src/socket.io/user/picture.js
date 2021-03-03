'use strict';

const path = require('path');
const nconf = require('nconf');

const user = require('../../user');
const plugins = require('../../plugins');
const file = require('../../file');

module.exports = function (SocketUser) {
	SocketUser.changePicture = async function (socket, data) {
		if (!socket.uid) {
			throw new Error('[[error:invalid-uid]]');
		}

		if (!data) {
			throw new Error('[[error:invalid-data]]');
		}

		const { type } = data;
		let picture = '';
		await user.isAdminOrGlobalModOrSelf(socket.uid, data.uid);
		if (type === 'default') {
			picture = '';
		} else if (type === 'uploaded') {
			picture = await user.getUserField(data.uid, 'uploadedpicture');
		} else {
			const returnData = await plugins.hooks.fire('filter:user.getPicture', {
				uid: socket.uid,
				type: type,
				picture: undefined,
			});
			picture = returnData && returnData.picture;
		}

		const validBackgrounds = await user.getIconBackgrounds(socket.uid);
		if (!validBackgrounds.includes(data.bgColor)) {
			data.bgColor = validBackgrounds[0];
		}

		await user.updateProfile(socket.uid, {
			uid: data.uid,
			picture: picture,
			'icon:bgColor': data.bgColor,
		}, ['picture', 'icon:bgColor']);
	};

	SocketUser.removeUploadedPicture = async function (socket, data) {
		if (!socket.uid || !data || !data.uid) {
			throw new Error('[[error:invalid-data]]');
		}
		await user.isAdminOrSelf(socket.uid, data.uid);
		const userData = await user.getUserFields(data.uid, ['uploadedpicture', 'picture']);
		if (userData.uploadedpicture && !userData.uploadedpicture.startsWith('http')) {
			const pathToFile = path.join(nconf.get('base_dir'), 'public', userData.uploadedpicture);
			if (pathToFile.startsWith(nconf.get('upload_path'))) {
				file.delete(pathToFile);
			}
		}
		await user.setUserFields(data.uid, {
			uploadedpicture: '',
			// if current picture is uploaded picture, reset to user icon
			picture: userData.uploadedpicture === userData.picture ? '' : userData.picture,
		});
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
