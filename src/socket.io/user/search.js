'use strict';

const user = require('../../user');
const pagination = require('../../pagination');
const privileges = require('../../privileges');

module.exports = function (SocketUser) {
	SocketUser.search = async function (socket, data) {
		// TODO: depracate and use usersController.search
		if (!data) {
			throw new Error('[[error:invalid-data]]');
		}
		const [allowed, isPrivileged] = await Promise.all([
			privileges.global.can('search:users', socket.uid),
			user.isPrivileged(socket.uid),
		]);

		let filters = data.filters || [];
		filters = Array.isArray(filters) ? filters : [filters];
		if (!allowed ||
			((
				data.searchBy === 'ip' ||
				data.searchBy === 'email' ||
				filters.includes('banned') ||
				filters.includes('flagged')
			) && !isPrivileged)
		) {
			throw new Error('[[error:no-privileges]]');
		}
		const result = await user.search({
			query: data.query,
			page: data.page,
			searchBy: data.searchBy,
			sortBy: data.sortBy,
			filters: data.filters,
			paginate: data.paginate,
			uid: socket.uid,
		});
		result.pagination = pagination.create(data.page, result.pageCount);
		result['route_users:' + data.sortBy] = true;
		return result;
	};
};
