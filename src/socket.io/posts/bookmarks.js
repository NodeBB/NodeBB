'use strict';

const sockets = require('..');
const api = require('../../api');

module.exports = function (SocketPosts) {
	SocketPosts.bookmark = async function (socket, data) {
		sockets.warnDeprecated(socket, 'PUT /api/v3/posts/:pid/bookmark');
		return await api.posts.bookmark(socket, data);
	};

	SocketPosts.unbookmark = async function (socket, data) {
		sockets.warnDeprecated(socket, 'DELETE /api/v3/posts/:pid/bookmark');
		return await api.posts.unbookmark(socket, data);
	};
};
