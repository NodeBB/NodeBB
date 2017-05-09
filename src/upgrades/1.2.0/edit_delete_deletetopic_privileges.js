'use strict';

var db = require('../../database');

var async = require('async');
var winston = require('winston');

module.exports = {
	name: 'Granting edit/delete/delete topic on existing categories',
	timestamp: Date.UTC(2016, 7, 7),
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
								if (group.privileges['groups:topics:reply']) {
									return async.parallel([
										async.apply(groupsAPI.join, 'cid:' + cid + ':privileges:groups:posts:edit', group.name),
										async.apply(groupsAPI.join, 'cid:' + cid + ':privileges:groups:posts:delete', group.name),
									], function (err) {
										if (!err) {
											winston.verbose('cid:' + cid + ':privileges:groups:posts:edit, cid:' + cid + ':privileges:groups:posts:delete granted to gid: ' + group.name);
										}

										return next(err);
									});
								}

								next(null);
							}, next);
						},
						function (next) {
							async.eachSeries(groups, function (group, next) {
								if (group.privileges['groups:topics:create']) {
									return groupsAPI.join('cid:' + cid + ':privileges:groups:topics:delete', group.name, function (err) {
										if (!err) {
											winston.verbose('cid:' + cid + ':privileges:groups:topics:delete granted to gid: ' + group.name);
										}

										return next(err);
									});
								}

								next(null);
							}, next);
						},
						function (next) {
							async.eachSeries(users, function (user, next) {
								if (user.privileges['topics:reply']) {
									return async.parallel([
										async.apply(groupsAPI.join, 'cid:' + cid + ':privileges:posts:edit', user.uid),
										async.apply(groupsAPI.join, 'cid:' + cid + ':privileges:posts:delete', user.uid),
									], function (err) {
										if (!err) {
											winston.verbose('cid:' + cid + ':privileges:posts:edit, cid:' + cid + ':privileges:posts:delete granted to uid: ' + user.uid);
										}

										return next(err);
									});
								}

								next(null);
							}, next);
						},
						function (next) {
							async.eachSeries(users, function (user, next) {
								if (user.privileges['topics:create']) {
									return groupsAPI.join('cid:' + cid + ':privileges:topics:delete', user.uid, function (err) {
										if (!err) {
											winston.verbose('cid:' + cid + ':privileges:topics:delete granted to uid: ' + user.uid);
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
