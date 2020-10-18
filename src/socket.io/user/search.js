'use strict';

const pagination = require('../../pagination');
const api = require('../../api');
const sockets = require('..');

module.exports = function (SocketUser) {
	SocketUser.search = async function (socket, data) {
		sockets.warnDeprecated(socket, 'GET /api/users');
		if (!data) {
			throw new Error('[[error:invalid-data]]');
		}
		const result = api.users.search(socket, data);
		result.pagination = pagination.create(data.page, result.pageCount);
		return result;
	};
};
