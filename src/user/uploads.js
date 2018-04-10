'use strict';

var async = require('async');

var db = require('../database');
var file = require('../file');

module.exports = function (User) {
	User.deleteUpload = function (uid, url, callback) {
		async.waterfall([
			function (next) {
				async.parallel({
					isUsersUpload: function (next) {
						db.isSortedSetMember('uid:' + uid + ':uploads', url, next);
					},
					isAdminOrGlobalMod: function (next) {
						User.isAdminOrGlobalMod(uid, next);
					},
				}, next);
			},
			function (results, next) {
				if (!results.isAdminOrGlobalMod && !results.isUsersUpload) {
					return next(new Error('[[error:no-privileges]]'));
				}

				file.delete(file.uploadUrlToPath(url), next);
			},
		], callback);
	};
};
