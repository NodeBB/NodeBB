'use strict';

const user = require('../../user');
const events = require('../../events');

module.exports = function (SocketUser) {
	SocketUser.acceptRegistration = async function (socket, data) {
		const isAdminOrGlobalMod = await user.isAdminOrGlobalMod(socket.uid);
		if (!isAdminOrGlobalMod) {
			throw new Error('[[error:no-privileges]]');
		}
		const uid = await user.acceptRegistration(data.username);
		await events.log({
			type: 'registration-approved',
			uid: socket.uid,
			ip: socket.ip,
			targetUid: uid,
		});
		return uid;
	};

	SocketUser.rejectRegistration = async function (socket, data) {
		const isAdminOrGlobalMod = await user.isAdminOrGlobalMod(socket.uid);
		if (!isAdminOrGlobalMod) {
			throw new Error('[[error:no-privileges]]');
		}
		await user.rejectRegistration(data.username);
		await events.log({
			type: 'registration-rejected',
			uid: socket.uid,
			ip: socket.ip,
			username: data.username,
		});
	};

	SocketUser.deleteInvitation = async function (socket, data) {
		const isAdminOrGlobalMod = await user.isAdminOrGlobalMod(socket.uid);
		if (!isAdminOrGlobalMod) {
			throw new Error('[[error:no-privileges]]');
		}
		await user.deleteInvitation(data.invitedBy, data.email);
	};
};
