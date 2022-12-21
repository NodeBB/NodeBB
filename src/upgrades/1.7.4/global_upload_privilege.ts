'use strict';


const async = require('async');
const groups = require('../../groups');
const privileges = require('../../privileges');
const db = require('../../database');

module.exports = {
	name: 'Give upload privilege to registered-users globally if it is given on a category',
	timestamp: Date.UTC(2018, 0, 3),
	method: function (callback) {
		db.getSortedSetRange('categories:cid', 0, -1, (err, cids) => {
			if (err) {
				return callback(err);
			}
			async.eachSeries(cids, (cid, next) => {
				getGroupPrivileges(cid, (err, groupPrivileges) => {
					if (err) {
						return next(err);
					}

					const privs = [];
					if (groupPrivileges['groups:upload:post:image']) {
						privs.push('groups:upload:post:image');
					}
					if (groupPrivileges['groups:upload:post:file']) {
						privs.push('groups:upload:post:file');
					}
					privileges.global.give(privs, 'registered-users', next);
				});
			}, callback);
		});
	},
};

function getGroupPrivileges(cid, callback) {
	const tasks = {};

	['groups:upload:post:image', 'groups:upload:post:file'].forEach((privilege) => {
		tasks[privilege] = async.apply(groups.isMember, 'registered-users', `cid:${cid}:privileges:${privilege}`);
	});

	async.parallel(tasks, callback);
}
