'use strict';

var async = require('async');
var db = require('../../database');
var privileges = require('../../privileges');
var groups = require('../../groups');

module.exports = {
	name: 'give mod info privilege',
	timestamp: Date.UTC(2019, 9, 8),
	method: function (callback) {
		async.waterfall([
			function (next) {
				db.getSortedSetRevRange('categories:cid', 0, -1, next);
			},
			function (cids, next) {
				async.eachSeries(cids, (cid, next) => {
					async.waterfall([
						function (next) {
							givePrivsToModerators(cid, '', next);
						},
						function (next) {
							givePrivsToModerators(cid, 'groups:', next);
						},
					], next);
				}, next);
			},
			function (next) {
				privileges.global.give(['groups:view:users:info'], 'Global Moderators', next);
			},
		], callback);
		function givePrivsToModerators(cid, groupPrefix, callback) {
			async.waterfall([
				function (next) {
					db.getSortedSetRevRange(`group:cid:${cid}:privileges:${groupPrefix}moderate:members`, 0, -1, next);
				},
				function (members, next) {
					async.eachSeries(members, (member, next) => {
						groups.join(['cid:0:privileges:view:users:info'], member, next);
					}, next);
				},
			], callback);
		}
	},
};
