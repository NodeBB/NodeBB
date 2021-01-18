'use strict';

const api = require('../../api');
const sockets = require('..');

module.exports = function (SocketPosts) {
	SocketPosts.movePost = async function (socket, data) {
		sockets.warnDeprecated(socket, 'PUT /api/v3/posts/:pid/move');
		await api.posts.move(socket, data);
	};

	SocketPosts.movePosts = async function (socket, data) {
		sockets.warnDeprecated(socket, 'PUT /api/v3/posts/:pid/move');
		await Promise.all(data.pids.map(async pid => api.posts.move(socket, {
			tid: data.tid,
			pid,
		})));
	};
};
