'use strict';

const sockets = require('..');
const api = require('../../api');

module.exports = function (SocketCategories) {
	SocketCategories.categorySearch = async function (socket, data) {
		sockets.warnDeprecated(socket, 'GET /api/v3/search/categories');

		const { categories } = await api.search.categories(socket, data);
		return categories;
	};
};
