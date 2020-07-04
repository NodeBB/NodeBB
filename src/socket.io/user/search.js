'use strict';

const user = require('../../user');
const pagination = require('../../pagination');
const privileges = require('../../privileges');

module.exports = function (SocketUser) {
	SocketUser.search = async function (socket, data) {
		if (!data) {
			throw new Error('[[error:invalid-data]]');
		}
		const [allowed, isPrivileged] = await Promise.all([
			privileges.global.can('search:users', socket.uid),
			user.isPrivileged(socket.uid),
		]);

		if (!allowed || ((data.searchBy === 'ip' || data.searchBy === 'email' || data.bannedOnly || data.flaggedOnly) && !isPrivileged)) {
			throw new Error('[[error:no-privileges]]');
		}
		const result = await user.search({
			query: data.query,
			page: data.page,
			searchBy: data.searchBy,
			sortBy: data.sortBy,
			onlineOnly: data.onlineOnly,
			bannedOnly: data.bannedOnly,
			flaggedOnly: data.flaggedOnly,
			paginate: data.paginate,
			uid: socket.uid,
		});
		result.pagination = pagination.create(data.page, result.pageCount);
		result['route_users:' + data.sortBy] = true;
		return result;
	};
};
