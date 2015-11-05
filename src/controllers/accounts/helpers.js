'use strict';


var async = require('async'),
	validator = require('validator'),
	nconf = require('nconf'),

	user = require('../../user'),
	groups = require('../../groups'),
	plugins =require('../../plugins'),
	meta = require('../../meta'),
	utils = require('../../../public/src/utils');

var helpers = {};

helpers.getUserDataByUserSlug = function(userslug, callerUID, callback) {
	async.waterfall([
		function (next) {
			user.getUidByUserslug(userslug, next);
		},
		function (uid, next) {
			if (!uid) {
				return callback(null, null);
			}

			async.parallel({
				userData : function(next) {
					user.getUserData(uid, next);
				},
				userSettings : function(next) {
					user.getSettings(uid, next);
				},
				isAdmin : function(next) {
					user.isAdministrator(callerUID, next);
				},
				ips: function(next) {
					user.getIPs(uid, 4, next);
				},
				profile_links: function(next) {
					plugins.fireHook('filter:user.profileLinks', [], next);
				},
				groups: function(next) {
					groups.getUserGroups([uid], next);
				},
				sso: function(next) {
					plugins.fireHook('filter:auth.list', {uid: uid, associations: []}, next);
				}
			}, next);
		},
		function (results, next) {
			if (!results.userData) {
				return callback(new Error('[[error:invalid-uid]]'));
			}

			var userData = results.userData;
			var userSettings = results.userSettings;
			var isAdmin = results.isAdmin;
			var self = parseInt(callerUID, 10) === parseInt(userData.uid, 10);

			userData.joindate = utils.toISOString(userData.joindate);
			userData.lastonlineISO = utils.toISOString(userData.lastonline || userData.joindate);
			userData.age = userData.birthday ? Math.floor((new Date().getTime() - new Date(userData.birthday).getTime()) / 31536000000) : '';

			if (!(isAdmin || self || (userData.email && userSettings.showemail))) {
				userData.email = '';
			}

			userData.emailClass = (self && !userSettings.showemail) ? '' : 'hide';

			if (!self && !userSettings.showfullname) {
				userData.fullname = '';
			}

			if (isAdmin || self) {
				userData.ips = results.ips;
			}

			userData.uid = userData.uid;
			userData.yourid = callerUID;
			userData.theirid = userData.uid;
			userData.isAdmin = isAdmin;
			userData.isSelf = self;
			userData.showHidden = self || isAdmin;
			userData.groups = Array.isArray(results.groups) && results.groups.length ? results.groups[0] : [];
			userData.disableSignatures = meta.config.disableSignatures !== undefined && parseInt(meta.config.disableSignatures, 10) === 1;
			userData['email:confirmed'] = !!parseInt(userData['email:confirmed'], 10);
			userData.profile_links = results.profile_links;
			userData.sso = results.sso.associations;
			userData.status = user.getStatus(userData);
			userData.banned = parseInt(userData.banned, 10) === 1;
			userData.website = validator.escape(userData.website);
			userData.websiteLink = !userData.website.startsWith('http') ? 'http://' + userData.website : userData.website;
			userData.websiteName = userData.website.replace(validator.escape('http://'), '').replace(validator.escape('https://'), '');
			userData.followingCount = parseInt(userData.followingCount, 10) || 0;
			userData.followerCount = parseInt(userData.followerCount, 10) || 0;

			userData.username = validator.escape(userData.username);
			userData.email = validator.escape(userData.email);
			userData.fullname = validator.escape(userData.fullname);
			userData.location = validator.escape(userData.location);
			userData.signature = validator.escape(userData.signature);
			userData.aboutme = validator.escape(userData.aboutme || '');

			userData['cover:url'] = userData['cover:url'] || require('../../coverPhoto').getDefaultProfileCover(userData.uid);
			userData['cover:position'] = userData['cover:position'] || '50% 50%';

			next(null, userData);
		}
	], callback);
};


helpers.getBaseUser = function(userslug, callerUID, callback) {
	async.waterfall([
		function (next) {
			user.getUidByUserslug(userslug, next);
		},
		function (uid, next) {
			if (!uid) {
				return callback(null, null);
			}

			async.parallel({
				user: function(next) {
					user.getUserFields(uid, ['uid', 'username', 'userslug', 'picture', 'cover:url', 'cover:position'], next);
				},
				isAdmin: function(next) {
					user.isAdministrator(callerUID, next);
				},
				profile_links: function(next) {
					plugins.fireHook('filter:user.profileLinks', [], next);
				}
			}, next);
		},
		function (results, next) {
			if (!results.user) {
				return callback();
			}

			results.user.yourid = callerUID;
			results.user.theirid = results.user.uid;
			results.user.isSelf = parseInt(callerUID, 10) === parseInt(results.user.uid, 10);
			results.user.showHidden = results.user.isSelf || results.isAdmin;
			results.user.profile_links = results.profile_links;

			results.user['cover:url'] = results.user['cover:url'] || require('../../coverPhoto').getDefaultProfileCover(results.user.uid);
			results.user['cover:position'] = results.user['cover:position'] || '50% 50%';

			next(null, results.user);
		}
	], callback);
};

module.exports = helpers;