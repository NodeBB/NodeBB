'use strict';


var helpers = require('./helpers');

module.exports = function (SocketPosts) {
	SocketPosts.bookmark = function (socket, data, callback) {
		helpers.postCommand(socket, 'bookmark', 'bookmarked', '', data, callback);
	};

	SocketPosts.unbookmark = function (socket, data, callback) {
		helpers.postCommand(socket, 'unbookmark', 'bookmarked', '', data, callback);
	};
};
