'use strict';

const api = require('../../api');
const sockets = require('..');

module.exports = function (SocketPosts) {
	function moveChecks(socket, typeCheck, data) {
		if (!socket.uid) {
			throw new Error('[[error:not-logged-in]]');
		}

		if (!data || !typeCheck || !data.tid) {
			throw new Error('[[error:invalid-data]]');
		}
	}

	SocketPosts.movePost = async function (socket, data) {
		sockets.warnDeprecated(socket, 'PUT /api/v3/posts/:pid/move');

		moveChecks(socket, isFinite(data.pid), data);
		await api.posts.move(socket, data);
	};

	SocketPosts.movePosts = async function (socket, data) {
		sockets.warnDeprecated(socket, 'PUT /api/v3/posts/:pid/move');

		moveChecks(socket, !Array.isArray(data.pids), data);
		await Promise.all(data.pids.map(async pid => api.posts.move(socket, {
			tid: data.tid,
			pid,
		})));
	};
};
