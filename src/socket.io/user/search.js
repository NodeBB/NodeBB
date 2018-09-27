'use strict';

var async = require('async');

var user = require('../../user');
var pagination = require('../../pagination');
var privileges = require('../../privileges');

module.exports = function (SocketUser) {
	SocketUser.search = function (socket, data, callback) {
		if (!data) {
			return callback(new Error('[[error:invalid-data]]'));
		}

		async.waterfall([
			function (next) {
				privileges.global.can('search:users', socket.uid, next);
			},
			function (allowed, next) {
				if (!allowed) {
					return next(new Error('[[error:no-privileges]]'));
				}
				user.search({
					query: data.query,
					page: data.page,
					searchBy: data.searchBy,
					sortBy: data.sortBy,
					onlineOnly: data.onlineOnly,
					bannedOnly: data.bannedOnly,
					flaggedOnly: data.flaggedOnly,
					paginate: data.paginate,
					uid: socket.uid,
				}, next);
			},
			function (result, next) {
				result.pagination = pagination.create(data.page, result.pageCount);
				result['route_users:' + data.sortBy] = true;
				next(null, result);
			},
		], callback);
	};
};
