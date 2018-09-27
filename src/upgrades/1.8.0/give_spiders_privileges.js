'use strict';


var async = require('async');
var groups = require('../../groups');
var privileges = require('../../privileges');
var db = require('../../database');

module.exports = {
	name: 'Give category access privileges to spiders system group',
	timestamp: Date.UTC(2018, 0, 31),
	method: function (callback) {
		db.getSortedSetRange('categories:cid', 0, -1, function (err, cids) {
			if (err) {
				return callback(err);
			}
			async.eachSeries(cids, function (cid, next) {
				getGroupPrivileges(cid, function (err, groupPrivileges) {
					if (err) {
						return next(err);
					}

					var privs = [];
					if (groupPrivileges['groups:find']) {
						privs.push('find');
					}
					if (groupPrivileges['groups:read']) {
						privs.push('read');
					}
					if (groupPrivileges['groups:topics:read']) {
						privs.push('topics:read');
					}

					privileges.categories.give(privs, cid, 'spiders', next);
				});
			}, callback);
		});
	},
};

function getGroupPrivileges(cid, callback) {
	var tasks = {};

	['groups:find', 'groups:read', 'groups:topics:read'].forEach(function (privilege) {
		tasks[privilege] = async.apply(groups.isMember, 'guests', 'cid:' + cid + ':privileges:' + privilege);
	});

	async.parallel(tasks, callback);
}
