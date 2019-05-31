'use strict';

var async = require('async');
var privileges = require('../../privileges');
var groups = require('../../groups');
var db = require('../../database');

module.exports = {
	name: 'Give mods explicit privileges',
	timestamp: Date.UTC(2019, 4, 28),
	method: function (callback) {
		var defaultPrivileges = [
			'find',
			'read',
			'topics:read',
			'topics:create',
			'topics:reply',
			'topics:tag',
			'posts:edit',
			'posts:history',
			'posts:delete',
			'posts:upvote',
			'posts:downvote',
			'topics:delete',
		];
		const modPrivileges = defaultPrivileges.concat([
			'posts:view_deleted',
			'purge',
		]);

		const globalModPrivs = [
			'chat',
			'upload:post:image',
			'upload:post:file',
			'signature',
			'ban',
			'search:content',
			'search:users',
			'search:tags',
			'view:users',
			'view:tags',
			'view:groups',
			'local:login',
		];

		async.waterfall([
			function (next) {
				db.getSortedSetRevRange('categories:cid', 0, -1, next);
			},
			function (cids, next) {
				async.eachSeries(cids, function (cid, next) {
					async.waterfall([
						function (next) {
							givePrivsToModerators(cid, '', next);
						},
						function (next) {
							givePrivsToModerators(cid, 'groups:', next);
						},
						function (next) {
							privileges.categories.give(modPrivileges, cid, ['Global Moderators'], next);
						},
					], next);
				}, next);
			},
			function (next) {
				privileges.global.give(globalModPrivs, 'Global Moderators', next);
			},
		], callback);

		function givePrivsToModerators(cid, groupPrefix, callback) {
			const privGroups = modPrivileges.map(function (priv) {
				return 'cid:' + cid + ':privileges:' + groupPrefix + priv;
			});

			async.waterfall([
				function (next) {
					db.getSortedSetRevRange('group:cid:' + cid + ':privileges:' + groupPrefix + 'moderate:members', 0, -1, next);
				},
				function (members, next) {
					async.eachSeries(members, function (member, next) {
						groups.join(privGroups, member, next);
					}, next);
				},
			], callback);
		}
	},
};
