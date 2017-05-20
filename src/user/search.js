
'use strict';

var async = require('async');
var meta = require('../meta');
var plugins = require('../plugins');
var db = require('../database');

module.exports = function (User) {
	User.search = function (data, callback) {
		var query = data.query || '';
		var searchBy = data.searchBy || 'username';
		var page = data.page || 1;
		var uid = data.uid || 0;
		var paginate = data.hasOwnProperty('paginate') ? data.paginate : true;

		if (searchBy === 'ip') {
			return searchByIP(query, uid, callback);
		}

		var startTime = process.hrtime();

		var searchResult = {};
		async.waterfall([
			function (next) {
				if (data.findUids) {
					data.findUids(query, searchBy, next);
				} else {
					findUids(query, searchBy, next);
				}
			},
			function (uids, next) {
				filterAndSortUids(uids, data, next);
			},
			function (uids, next) {
				plugins.fireHook('filter:users.search', { uids: uids, uid: uid }, next);
			},
			function (data, next) {
				var uids = data.uids;
				searchResult.matchCount = uids.length;

				if (paginate) {
					var resultsPerPage = parseInt(meta.config.userSearchResultsPerPage, 10) || 20;
					var start = Math.max(0, page - 1) * resultsPerPage;
					var stop = start + resultsPerPage;
					searchResult.pageCount = Math.ceil(uids.length / resultsPerPage);
					uids = uids.slice(start, stop);
				}

				User.getUsers(uids, uid, next);
			},
			function (userData, next) {
				searchResult.timing = (process.elapsedTimeSince(startTime) / 1000).toFixed(2);
				searchResult.users = userData;
				next(null, searchResult);
			},
		], callback);
	};

	function findUids(query, searchBy, callback) {
		if (!query) {
			return callback(null, []);
		}
		query = query.toLowerCase();
		var min = query;
		var max = query.substr(0, query.length - 1) + String.fromCharCode(query.charCodeAt(query.length - 1) + 1);

		var resultsPerPage = parseInt(meta.config.userSearchResultsPerPage, 10) || 20;
		var hardCap = resultsPerPage * 10;

		async.waterfall([
			function (next) {
				db.getSortedSetRangeByLex(searchBy + ':sorted', min, max, 0, hardCap, next);
			},
			function (data, next) {
				var uids = data.map(function (data) {
					return data.split(':')[1];
				});
				next(null, uids);
			},
		], callback);
	}

	function filterAndSortUids(uids, data, callback) {
		var sortBy = data.sortBy || 'joindate';

		var fields = ['uid', sortBy];
		if (data.onlineOnly) {
			fields = fields.concat(['status', 'lastonline']);
		}
		if (data.bannedOnly) {
			fields.push('banned');
		}
		if (data.flaggedOnly) {
			fields.push('flags');
		}

		async.waterfall([
			function (next) {
				User.getUsersFields(uids, fields, next);
			},
			function (userData, next) {
				if (data.onlineOnly) {
					userData = userData.filter(function (user) {
						return user && user.status !== 'offline' && (Date.now() - parseInt(user.lastonline, 10) < 300000);
					});
				}

				if (data.bannedOnly) {
					userData = userData.filter(function (user) {
						return user && parseInt(user.banned, 10) === 1;
					});
				}

				if (data.flaggedOnly) {
					userData = userData.filter(function (user) {
						return user && parseInt(user.flags, 10) > 0;
					});
				}

				sortUsers(userData, sortBy);

				uids = userData.map(function (user) {
					return user && user.uid;
				});

				next(null, uids);
			},
		], callback);
	}

	function sortUsers(userData, sortBy) {
		if (sortBy === 'joindate' || sortBy === 'postcount' || sortBy === 'reputation') {
			userData.sort(function (u1, u2) {
				return u2[sortBy] - u1[sortBy];
			});
		} else {
			userData.sort(function (u1, u2) {
				if (u1[sortBy] < u2[sortBy]) {
					return -1;
				} else if (u1[sortBy] > u2[sortBy]) {
					return 1;
				}
				return 0;
			});
		}
	}

	function searchByIP(ip, uid, callback) {
		var start = process.hrtime();
		async.waterfall([
			function (next) {
				db.getSortedSetRevRange('ip:' + ip + ':uid', 0, -1, next);
			},
			function (uids, next) {
				User.getUsers(uids, uid, next);
			},
			function (users, next) {
				var diff = process.hrtime(start);
				var timing = ((diff[0] * 1e3) + (diff[1] / 1e6)).toFixed(1);
				next(null, { timing: timing, users: users });
			},
		], callback);
	}
};
