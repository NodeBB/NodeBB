'use strict';

const validator = require('validator');
const nconf = require('nconf');

const db = require('../../database');
const user = require('../../user');
const plugins = require('../../plugins');

module.exports = function (SocketUser) {
	SocketUser.removeUploadedPicture = async function (socket, data) {
		if (!socket.uid || !data || !data.uid) {
			throw new Error('[[error:invalid-data]]');
		}
		await user.isAdminOrSelf(socket.uid, data.uid);
		// 'keepAllUserImages' is ignored, since there is explicit user intent
		const userData = await user.removeProfileImage(data.uid, data.picture);
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

		const [list, userObj, userPictures] = await Promise.all([
			plugins.hooks.fire('filter:user.listPictures', {
				uid: data.uid,
				pictures: [],
			}),
			user.getUserData(data.uid),
			db.getSortedSetRevRange(`uid:${data.uid}:profile:pictures`, 0, 2),
		]);

		userPictures.forEach((picture) => {
			list.pictures.push({
				type: 'uploaded',
				url: picture.startsWith('http') ? picture : `${nconf.get('relative_path')}${picture}`,
				text: '[[user:uploaded-picture]]',
			});
		});

		// Normalize list into "user object" format
		list.pictures = list.pictures.map(({ type, url, text }) => ({
			type,
			username: text,
			picture: validator.escape(String(url)),
			selected: url === userObj.picture,
		}));

		list.pictures.unshift({
			type: 'default',
			'icon:text': userObj['icon:text'],
			'icon:bgColor': userObj['icon:bgColor'],
			username: '[[user:default-picture]]',
			selected: !userObj.picture,
		});

		return list.pictures;
	};
};
