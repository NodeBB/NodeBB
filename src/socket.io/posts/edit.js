'use strict';

const api = require('../../api');
const websockets = require('../index');

module.exports = function (SocketPosts) {
	SocketPosts.edit = async function (socket, data) {
		websockets.warnDeprecated(socket, 'PUT /api/v3/posts/:pid');

		if (!socket.uid) {
			throw new Error('[[error:not-logged-in]]');
		}

		return await api.posts.edit(socket, data);
	};
};
