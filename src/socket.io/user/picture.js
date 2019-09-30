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

		const type = data.type;
		let picture = '';
		await user.isAdminOrGlobalModOrSelf(socket.uid, data.uid);
		if (type === 'default') {
			picture = '';
		} else if (type === 'uploaded') {
			picture = await user.getUserField(data.uid, 'uploadedpicture');
		} else {
			const returnData = await plugins.fireHook('filter:user.getPicture', {
				uid: socket.uid,
				type: type,
				picture: undefined,
			});
			picture = returnData && returnData.picture;
		}

		await user.setUserField(data.uid, 'picture', picture);
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
		plugins.fireHook('action:user.removeUploadedPicture', { callerUid: socket.uid, uid: data.uid });
	};

	SocketUser.getProfilePictures = async function (socket, data) {
		if (!data || !data.uid) {
			throw new Error('[[error:invalid-data]]');
		}

		const [list, uploaded] = await Promise.all([
			plugins.fireHook('filter:user.listPictures', {
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
