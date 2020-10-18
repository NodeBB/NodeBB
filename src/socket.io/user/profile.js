'use strict';

const winston = require('winston');

const api = require('../../api');
const user = require('../../user');
const events = require('../../events');
const notifications = require('../../notifications');
const db = require('../../database');
const plugins = require('../../plugins');
const sockets = require('..');

module.exports = function (SocketUser) {
	SocketUser.changeUsernameEmail = async function (socket, data) {
		sockets.warnDeprecated(socket, 'PUT /api/v3/users/:uid');

		if (!data || !data.uid || !socket.uid) {
			throw new Error('[[error:invalid-data]]');
		}
		await isPrivilegedOrSelfAndPasswordMatch(socket, data);
		return await SocketUser.updateProfile(socket, data);
	};

	SocketUser.updateCover = async function (socket, data) {
		if (!socket.uid) {
			throw new Error('[[error:no-privileges]]');
		}
		await user.isAdminOrGlobalModOrSelf(socket.uid, data.uid);
		await user.checkMinReputation(socket.uid, data.uid, 'min:rep:cover-picture');
		return await user.updateCoverPicture(data);
	};

	SocketUser.uploadCroppedPicture = async function (socket, data) {
		if (!socket.uid) {
			throw new Error('[[error:no-privileges]]');
		}
		await user.isAdminOrGlobalModOrSelf(socket.uid, data.uid);
		await user.checkMinReputation(socket.uid, data.uid, 'min:rep:profile-picture');
		return await user.uploadCroppedPicture(data);
	};

	SocketUser.removeCover = async function (socket, data) {
		if (!socket.uid) {
			throw new Error('[[error:no-privileges]]');
		}
		await user.isAdminOrGlobalModOrSelf(socket.uid, data.uid);
		const userData = await user.getUserFields(data.uid, ['cover:url']);
		await user.removeCoverPicture(data);
		plugins.fireHook('action:user.removeCoverPicture', {
			callerUid: socket.uid,
			uid: data.uid,
			user: userData,
		});
	};

	async function isPrivilegedOrSelfAndPasswordMatch(socket, data) {
		const uid = socket.uid;
		const isSelf = parseInt(uid, 10) === parseInt(data.uid, 10);

		const [isAdmin, isTargetAdmin, isGlobalMod] = await Promise.all([
			user.isAdministrator(uid),
			user.isAdministrator(data.uid),
			user.isGlobalModerator(uid),
		]);

		if ((isTargetAdmin && !isAdmin) || (!isSelf && !(isAdmin || isGlobalMod))) {
			throw new Error('[[error:no-privileges]]');
		}
		const [hasPassword, passwordMatch] = await Promise.all([
			user.hasPassword(data.uid),
			data.password ? user.isPasswordCorrect(data.uid, data.password, socket.ip) : false,
		]);

		if (isSelf && hasPassword && !passwordMatch) {
			throw new Error('[[error:invalid-password]]');
		}
	}

	SocketUser.changePassword = async function (socket, data) {
		sockets.warnDeprecated(socket, 'PUT /api/v3/users/:uid/password');
		await api.users.changePassword(socket, data);
	};

	SocketUser.updateProfile = async function (socket, data) {
		sockets.warnDeprecated(socket, 'PUT /api/v3/users/:uid');
		return await api.users.update(socket, data);
	};

	SocketUser.toggleBlock = async function (socket, data) {
		const [is] = await Promise.all([
			user.blocks.is(data.blockeeUid, data.blockerUid),
			user.blocks.can(socket.uid, data.blockerUid, data.blockeeUid),
		]);
		const isBlocked = is;
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
		if (!socket.uid) {
			throw new Error('[[error:invalid-uid]]');
		}

		if (!data || !(parseInt(data.uid, 10) > 0)) {
			throw new Error('[[error:invalid-data]]');
		}

		await user.isAdminOrSelf(socket.uid, data.uid);

		const count = await db.incrObjectField('locks', 'export:' + data.uid + type);
		if (count > 1) {
			throw new Error('[[error:already-exporting]]');
		}

		const child = require('child_process').fork('./src/user/jobs/export-' + type + '.js', [], {
			env: process.env,
		});
		child.send({ uid: data.uid });
		child.on('error', async function (err) {
			winston.error(err.stack);
			await db.deleteObjectField('locks', 'export:' + data.uid + type);
		});
		child.on('exit', async function () {
			await db.deleteObjectField('locks', 'export:' + data.uid + type);
			const userData = await user.getUserFields(data.uid, ['username', 'userslug']);
			const n = await notifications.create({
				bodyShort: '[[notifications:' + type + '-exported, ' + userData.username + ']]',
				path: '/api/user/uid/' + userData.userslug + '/export/' + type,
				nid: type + ':export:' + data.uid,
				from: data.uid,
			});
			await notifications.push(n, [socket.uid]);
			await events.log({
				type: 'export:' + type,
				uid: socket.uid,
				targetUid: data.uid,
				ip: socket.ip,
			});
		});
	}
};
