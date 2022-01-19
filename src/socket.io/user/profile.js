'use strict';

const winston = require('winston');

const user = require('../../user');
const events = require('../../events');
const notifications = require('../../notifications');
const privileges = require('../../privileges');
const db = require('../../database');
const plugins = require('../../plugins');

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

		if (!data || parseInt(data.uid, 10) <= 0) {
			throw new Error('[[error:invalid-data]]');
		}

		await user.isAdminOrSelf(socket.uid, data.uid);

		const count = await db.incrObjectField('locks', `export:${data.uid}${type}`);
		if (count > 1) {
			throw new Error('[[error:already-exporting]]');
		}

		const child = require('child_process').fork(`./src/user/jobs/export-${type}.js`, [], {
			env: process.env,
		});
		child.send({ uid: data.uid });
		child.on('error', async (err) => {
			winston.error(err.stack);
			await db.deleteObjectField('locks', `export:${data.uid}${type}`);
		});
		child.on('exit', async () => {
			await db.deleteObjectField('locks', `export:${data.uid}${type}`);
			const userData = await user.getUserFields(data.uid, ['username', 'userslug']);
			const { displayname } = userData;
			const n = await notifications.create({
				bodyShort: `[[notifications:${type}-exported, ${displayname}]]`,
				path: `/api/user/${userData.userslug}/export/${type}`,
				nid: `${type}:export:${data.uid}`,
				from: data.uid,
			});
			await notifications.push(n, [socket.uid]);
			await events.log({
				type: `export:${type}`,
				uid: socket.uid,
				targetUid: data.uid,
				ip: socket.ip,
			});
		});
	}
};
