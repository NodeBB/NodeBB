'use strict';

const api = require('../../api');
const websockets = require('../index');

module.exports = function (SocketUser) {
	SocketUser.banUsers = async function (socket, data) {
		websockets.warnDeprecated(socket, 'PUT /api/v3/users/:uid/ban');
		await Promise.all(data.uids.map(async (uid) => {
			const payload = { ...data };
			delete payload.uids;
			payload.uid = uid;
			await api.users.ban(socket, payload);
		}));
	};

	SocketUser.unbanUsers = async function (socket, uids) {
		websockets.warnDeprecated(socket, 'DELETE /api/v3/users/:uid/ban');
		await Promise.all(uids.map(async (uid) => {
			await api.users.unban(socket, { uid });
		}));
	};
};
