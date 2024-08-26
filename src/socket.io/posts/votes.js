'use strict';

const api = require('../../api');
const sockets = require('../index');

module.exports = function (SocketPosts) {
	SocketPosts.getVoters = async function (socket, data) {
		if (!data || !data.pid) {
			throw new Error('[[error:invalid-data]]');
		}
		sockets.warnDeprecated(socket, 'GET /api/v3/posts/:pid/voters');
		return await api.posts.getVoters(socket, { pid: data.pid });
	};

	SocketPosts.getUpvoters = async function (socket, pids) {
		if (!Array.isArray(pids)) {
			throw new Error('[[error:invalid-data]]');
		}
		sockets.warnDeprecated(socket, 'GET /api/v3/posts/:pid/upvoters');
		return await api.posts.getUpvoters(socket, { pid: pids[0] });
	};
};
