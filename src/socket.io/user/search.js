'use strict';

var user = require('../../user');
var meta = require('../../meta');
var pagination = require('../../pagination');

module.exports = function(SocketUser) {

	SocketUser.search = function(socket, data, callback) {
		if (!data) {
			return callback(new Error('[[error:invalid-data]]'));
		}
		if (!socket.uid && parseInt(meta.config.allowGuestUserSearching, 10) !== 1) {
			return callback(new Error('[[error:not-logged-in]]'));
		}
		user.search({
			query: data.query,
			page: data.page,
			searchBy: data.searchBy,
			sortBy: data.sortBy,
			onlineOnly: data.onlineOnly,
			bannedOnly: data.bannedOnly,
			uid: socket.uid
		}, function(err, result) {
			if (err) {
				return callback(err);
			}
			result.pagination = pagination.create(data.page, result.pageCount);
			result['route_users:' + data.sortBy] = true;
			callback(null, result);
		});
	};

};