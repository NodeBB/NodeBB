'use strict';

var db = require('../../database');

var async = require('async');
var winston = require('winston');

module.exports = {
	name: 'Giving topics:read privs to any group that was previously allowed to Find & Access Category',
	timestamp: Date.UTC(2016, 4, 28),
	method: function (callback) {
		var groupsAPI = require('../../groups');
		var privilegesAPI = require('../../privileges');

		db.getSortedSetRange('categories:cid', 0, -1, function (err, cids) {
			if (err) {
				return callback(err);
			}

			async.eachSeries(cids, function (cid, next) {
				privilegesAPI.categories.list(cid, function (err, data) {
					if (err) {
						return next(err);
					}

					var groups = data.groups;
					var users = data.users;

					async.waterfall([
						function (next) {
							async.eachSeries(groups, function (group, next) {
								if (group.privileges['groups:read']) {
									return groupsAPI.join('cid:' + cid + ':privileges:groups:topics:read', group.name, function (err) {
										if (!err) {
											winston.verbose('cid:' + cid + ':privileges:groups:topics:read granted to gid: ' + group.name);
										}

										return next(err);
									});
								}

								next(null);
							}, next);
						},
						function (next) {
							async.eachSeries(users, function (user, next) {
								if (user.privileges.read) {
									return groupsAPI.join('cid:' + cid + ':privileges:topics:read', user.uid, function (err) {
										if (!err) {
											winston.verbose('cid:' + cid + ':privileges:topics:read granted to uid: ' + user.uid);
										}

										return next(err);
									});
								}

								next(null);
							}, next);
						},
					], function (err) {
						if (!err) {
							winston.verbose('-- cid ' + cid + ' upgraded');
						}

						next(err);
					});
				});
			}, callback);
		});
	},
};
