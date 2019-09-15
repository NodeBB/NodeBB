'use strict';


const helpers = require('./helpers');

module.exports = function (SocketPosts) {
	SocketPosts.bookmark = async function (socket, data) {
		return await helpers.postCommand(socket, 'bookmark', 'bookmarked', '', data);
	};

	SocketPosts.unbookmark = async function (socket, data) {
		return await helpers.postCommand(socket, 'unbookmark', 'bookmarked', '', data);
	};
};
