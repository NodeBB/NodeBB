'use strict';

const api = require('../../api');
const websockets = require('..');

module.exports = function (SocketPosts) {
	SocketPosts.getDiffs = async function (socket, data) {
		websockets.warnDeprecated(socket, 'GET /api/v3/posts/:pid/diffs');
		return await api.posts.getDiffs(socket, data);
	};

	SocketPosts.showPostAt = async function (socket, data) {
		websockets.warnDeprecated(socket, 'GET /api/v3/posts/:pid/diffs/:since');
		return await api.posts.loadDiff(socket, data);
	};

	SocketPosts.restoreDiff = async function (socket, data) {
		websockets.warnDeprecated(socket, 'PUT /api/v3/posts/:pid/diffs/:since');
		return await api.posts.restoreDiff(socket, data);
	};
};
