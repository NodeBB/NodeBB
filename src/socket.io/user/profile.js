'use strict';

const user = require('../../user');
const privileges = require('../../privileges');
const plugins = require('../../plugins');

const sockets = require('..');
const api = require('../../api');

module.exports = function (SocketUser) {
	SocketUser.updateCover = async function (socket, data) {
		if (!socket.uid) {
			throw new Error('[[error:no-privileges]]');
		}
		await user.isAdminOrGlobalModOrSelf(socket.uid, data.uid);
		await user.checkMinReputation(socket.uid, data.uid, 'min:rep:cover-picture');
		return await user.updateCoverPicture(data);
	};

	SocketUser.uploadCroppedPicture = async function (socket, data) {
		if (!socket.uid || !(await privileges.users.canEdit(socket.uid, data.uid))) {
			throw new Error('[[error:no-privileges]]');
		}

		await user.checkMinReputation(socket.uid, data.uid, 'min:rep:profile-picture');
		data.callerUid = socket.uid;
		return await user.uploadCroppedPicture(data);
	};

	SocketUser.removeCover = async function (socket, data) {
		if (!socket.uid) {
			throw new Error('[[error:no-privileges]]');
		}
		await user.isAdminOrGlobalModOrSelf(socket.uid, data.uid);
		const userData = await user.getUserFields(data.uid, ['cover:url']);
		// 'keepAllUserImages' is ignored, since there is explicit user intent
		await user.removeCoverPicture(data);
		plugins.hooks.fire('action:user.removeCoverPicture', {
			callerUid: socket.uid,
			uid: data.uid,
			user: userData,
		});
	};

	SocketUser.toggleBlock = async function (socket, data) {
		const isBlocked = await user.blocks.is(data.blockeeUid, data.blockerUid);
		await user.blocks.can(socket.uid, data.blockerUid, data.blockeeUid, isBlocked ? 'unblock' : 'block');
		await user.blocks[isBlocked ? 'remove' : 'add'](data.blockeeUid, data.blockerUid);
		return !isBlocked;
	};

	SocketUser.exportProfile = async function (socket, data) {
		await doExport(socket, data, 'profile');
	};

	SocketUser.exportPosts = async function (socket, data) {
		await doExport(socket, data, 'posts');
	};

	SocketUser.exportUploads = async function (socket, data) {
		await doExport(socket, data, 'uploads');
	};

	async function doExport(socket, data, type) {
		sockets.warnDeprecated(socket, 'POST /api/v3/users/:uid/exports/:type');

		if (!socket.uid) {
			throw new Error('[[error:invalid-uid]]');
		}

		if (!data || parseInt(data.uid, 10) <= 0) {
			throw new Error('[[error:invalid-data]]');
		}

		await user.isAdminOrSelf(socket.uid, data.uid);

		api.users.generateExport(socket, { type, ...data });
	}
};
