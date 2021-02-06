'use strict';


const async = require('async');
const winston = require('winston');
const db = require('../../database');

module.exports = {
	name: 'Giving topics:read privs to any group that was previously allowed to Find & Access Category',
	timestamp: Date.UTC(2016, 4, 28),
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
								if (group.privileges['groups:read']) {
									return groupsAPI.join(`cid:${cid}:privileges:groups:topics:read`, group.name, (err) => {
										if (!err) {
											winston.verbose(`cid:${cid}:privileges:groups:topics:read granted to gid: ${group.name}`);
										}

										return next(err);
									});
								}

								next(null);
							}, next);
						},
						function (next) {
							async.eachSeries(users, (user, next) => {
								if (user.privileges.read) {
									return groupsAPI.join(`cid:${cid}:privileges:topics:read`, user.uid, (err) => {
										if (!err) {
											winston.verbose(`cid:${cid}:privileges:topics:read granted to uid: ${user.uid}`);
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
