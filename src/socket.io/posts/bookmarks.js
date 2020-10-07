'use strict';


const helpers = require('./helpers');
const sockets = require('..');

module.exports = function (SocketPosts) {
	SocketPosts.bookmark = async function (socket, data) {
		sockets.warnDeprecated(socket, 'PUT /api/v3/posts/:pid/bookmark');
		return await helpers.postCommand(socket, 'bookmark', 'bookmarked', '', data);
	};

	SocketPosts.unbookmark = async function (socket, data) {
		sockets.warnDeprecated(socket, 'DELETE /api/v3/posts/:pid/bookmark');
		return await helpers.postCommand(socket, 'unbookmark', 'bookmarked', '', data);
	};
};
