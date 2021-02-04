'use strict';


const async = require('async');
const groups = require('../../groups');
const privileges = require('../../privileges');
const db = require('../../database');

module.exports = {
	name: 'Give category access privileges to spiders system group',
	timestamp: Date.UTC(2018, 0, 31),
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
					if (groupPrivileges['groups:find']) {
						privs.push('groups:find');
					}
					if (groupPrivileges['groups:read']) {
						privs.push('groups:read');
					}
					if (groupPrivileges['groups:topics:read']) {
						privs.push('groups:topics:read');
					}

					privileges.categories.give(privs, cid, 'spiders', next);
				});
			}, callback);
		});
	},
};

function getGroupPrivileges(cid, callback) {
	const tasks = {};

	['groups:find', 'groups:read', 'groups:topics:read'].forEach((privilege) => {
		tasks[privilege] = async.apply(groups.isMember, 'guests', `cid:${cid}:privileges:${privilege}`);
	});

	async.parallel(tasks, callback);
}
