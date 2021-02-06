'use strict';


const async = require('async');
const winston = require('winston');
const db = require('../../database');

module.exports = {
	name: 'Granting edit/delete/delete topic on existing categories',
	timestamp: Date.UTC(2016, 7, 7),
	method: function (callback) {
		const groupsAPI = require('../../groups');
		const privilegesAPI = require('../../privileges');

		db.getSortedSetRange('categories:cid', 0, -1, (err, cids) => {
			if (err) {
				return callback(err);
			}

			async.eachSeries(cids, (cid, next) => {
				privilegesAPI.categories.list(cid, (err, data) => {
					if (err) {
						return next(err);
					}

					const { groups } = data;
					const { users } = data;

					async.waterfall([
						function (next) {
							async.eachSeries(groups, (group, next) => {
								if (group.privileges['groups:topics:reply']) {
									return async.parallel([
										async.apply(groupsAPI.join, `cid:${cid}:privileges:groups:posts:edit`, group.name),
										async.apply(groupsAPI.join, `cid:${cid}:privileges:groups:posts:delete`, group.name),
									], (err) => {
										if (!err) {
											winston.verbose(`cid:${cid}:privileges:groups:posts:edit, cid:${cid}:privileges:groups:posts:delete granted to gid: ${group.name}`);
										}

										return next(err);
									});
								}

								next(null);
							}, next);
						},
						function (next) {
							async.eachSeries(groups, (group, next) => {
								if (group.privileges['groups:topics:create']) {
									return groupsAPI.join(`cid:${cid}:privileges:groups:topics:delete`, group.name, (err) => {
										if (!err) {
											winston.verbose(`cid:${cid}:privileges:groups:topics:delete granted to gid: ${group.name}`);
										}

										return next(err);
									});
								}

								next(null);
							}, next);
						},
						function (next) {
							async.eachSeries(users, (user, next) => {
								if (user.privileges['topics:reply']) {
									return async.parallel([
										async.apply(groupsAPI.join, `cid:${cid}:privileges:posts:edit`, user.uid),
										async.apply(groupsAPI.join, `cid:${cid}:privileges:posts:delete`, user.uid),
									], (err) => {
										if (!err) {
											winston.verbose(`cid:${cid}:privileges:posts:edit, cid:${cid}:privileges:posts:delete granted to uid: ${user.uid}`);
										}

										return next(err);
									});
								}

								next(null);
							}, next);
						},
						function (next) {
							async.eachSeries(users, (user, next) => {
								if (user.privileges['topics:create']) {
									return groupsAPI.join(`cid:${cid}:privileges:topics:delete`, user.uid, (err) => {
										if (!err) {
											winston.verbose(`cid:${cid}:privileges:topics:delete granted to uid: ${user.uid}`);
										}

										return next(err);
									});
								}

								next(null);
							}, next);
						},
					], (err) => {
						if (!err) {
							winston.verbose(`-- cid ${cid} upgraded`);
						}

						next(err);
					});
				});
			}, callback);
		});
	},
};
