'use strict';

var async = require('async');
var path = require('path');
var nconf = require('nconf');

var db = require('../database');
var file = require('../file');

module.exports = function (User) {
	User.deleteUpload = function (callerUid, uid, uploadName, callback) {
		async.waterfall([
			function (next) {
				async.parallel({
					isUsersUpload: function (next) {
						db.isSortedSetMember('uid:' + callerUid + ':uploads', uploadName, next);
					},
					isAdminOrGlobalMod: function (next) {
						User.isAdminOrGlobalMod(callerUid, next);
					},
				}, next);
			},
			function (results, next) {
				if (!results.isAdminOrGlobalMod && !results.isUsersUpload) {
					return next(new Error('[[error:no-privileges]]'));
				}

				file.delete(path.join(nconf.get('upload_path'), uploadName), next);
			},
			function (next) {
				db.sortedSetRemove('uid:' + uid + ':uploads', uploadName, next);
			},
		], callback);
	};
};
