'use strict';

/**
 * v4 note — all socket.io methods here have been deprecated, and can be removed for v4
 */

const sockets = require('..');
const api = require('../../api');

module.exports = function (SocketCategories) {
	SocketCategories.categorySearch = async function (socket, data) {
		sockets.warnDeprecated(socket, 'GET /api/v3/search/categories');

		const { categories } = await api.search.categories(socket, data);
		return categories;
	};
};
