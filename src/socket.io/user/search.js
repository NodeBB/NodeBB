'use strict';

var async = require('async');

var db = require('../../database');
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

	SocketUser.loadSearchPage = function(socket, data, callback) {
		function done(err, result) {
			if (err) {
				return callback(err);
			}
			var pageCount = Math.ceil(result.count / resultsPerPage);
			var userData = {
				matchCount: result.users.length,
				timing: (process.elapsedTimeSince(startTime) / 1000).toFixed(2),
				users: result.users,
				pagination: pagination.create(data.page, pageCount),
				pageCount: pageCount
			};
			userData['route_users:' + data.sortBy] = true;

			callback(null, userData);
		}

		if (!data || !data.page) {
			return callback(new Error('[[error:invalid-data]]'));
		}
		var startTime = process.hrtime();
		var controllers = require('../../controllers/users');
		var pagination = require('../../pagination');

		var resultsPerPage = parseInt(meta.config.userSearchResultsPerPage, 10) || 20;
		var start = Math.max(0, data.page - 1) * resultsPerPage;
		var stop = start + resultsPerPage - 1;
		if (data.onlineOnly) {
			async.parallel({
				users: function(next) {
					user.getUsersFromSet('users:online', socket.uid, 0, 49, next);
				},
				count: function(next) {
					var now = Date.now();
					db.sortedSetCount('users:online', now - 300000, now, next);
				}
			}, done);
		} else {
			controllers.getUsersAndCount('users:' + data.sortBy, socket.uid, start, stop, done);
		}
	};



};