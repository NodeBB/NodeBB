'use strict';


var async = require('async');
var validator = require('validator');
var winston = require('winston');
var nconf = require('nconf');

var user = require('../../user');
var groups = require('../../groups');
var plugins = require('../../plugins');
var meta = require('../../meta');
var utils = require('../../utils');
var privileges = require('../../privileges');

var helpers = module.exports;

helpers.getUserDataByUserSlug = function (userslug, callerUID, callback) {
	async.waterfall([
		function (next) {
			user.getUidByUserslug(userslug, next);
		},
		function (uid, next) {
			if (!uid) {
				return callback(null, null);
			}

			async.parallel({
				userData: function (next) {
					user.getUserData(uid, next);
				},
				isTargetAdmin: function (next) {
					user.isAdministrator(uid, next);
				},
				userSettings: function (next) {
					user.getSettings(uid, next);
				},
				isAdmin: function (next) {
					user.isAdministrator(callerUID, next);
				},
				isGlobalModerator: function (next) {
					user.isGlobalModerator(callerUID, next);
				},
				isModerator: function (next) {
					user.isModeratorOfAnyCategory(callerUID, next);
				},
				isFollowing: function (next) {
					user.isFollowing(callerUID, uid, next);
				},
				ips: function (next) {
					user.getIPs(uid, 4, next);
				},
				profile_menu: function (next) {
					const links = [{
						id: 'info',
						route: 'info',
						name: '[[user:account_info]]',
						visibility: {
							self: false,
							other: false,
							moderator: true,
							globalMod: true,
							admin: true,
						},
					}, {
						id: 'sessions',
						route: 'sessions',
						name: '[[pages:account/sessions]]',
						visibility: {
							self: true,
							other: false,
							moderator: false,
							globalMod: false,
							admin: false,
						},
					}];

					if (meta.config.gdpr_enabled) {
						links.push({
							id: 'consent',
							route: 'consent',
							name: '[[user:consent.title]]',
							visibility: {
								self: true,
								other: false,
								moderator: false,
								globalMod: false,
								admin: false,
							},
						});
					}

					plugins.fireHook('filter:user.profileMenu', {
						uid: uid,
						callerUID: callerUID,
						links: links,
					}, next);
				},
				groups: function (next) {
					groups.getUserGroups([uid], next);
				},
				sso: function (next) {
					plugins.fireHook('filter:auth.list', { uid: uid, associations: [] }, next);
				},
				canEdit: function (next) {
					privileges.users.canEdit(callerUID, uid, next);
				},
				canBanUser: function (next) {
					privileges.users.canBanUser(callerUID, uid, next);
				},
				isBlocked: function (next) {
					user.blocks.is(uid, callerUID, next);
				},
			}, next);
		},
		function (results, next) {
			if (!results.userData) {
				return callback(new Error('[[error:invalid-uid]]'));
			}

			var userData = results.userData;
			var userSettings = results.userSettings;
			var isAdmin = results.isAdmin;
			var isGlobalModerator = results.isGlobalModerator;
			var isModerator = results.isModerator;
			var isSelf = parseInt(callerUID, 10) === parseInt(userData.uid, 10);

			userData.joindateISO = utils.toISOString(userData.joindate);
			userData.lastonlineISO = utils.toISOString(userData.lastonline || userData.joindate);
			userData.age = Math.max(0, userData.birthday ? Math.floor((new Date().getTime() - new Date(userData.birthday).getTime()) / 31536000000) : 0);

			userData.emailClass = 'hide';

			if (!isAdmin && !isGlobalModerator && !isSelf && (!userSettings.showemail || meta.config.hideEmail)) {
				userData.email = '';
			} else if (!userSettings.showemail) {
				userData.emailClass = '';
			}

			if (!isAdmin && !isGlobalModerator && !isSelf && (!userSettings.showfullname || meta.config.hideFullname)) {
				userData.fullname = '';
			}

			if (isAdmin || isSelf || ((isGlobalModerator || isModerator) && !results.isTargetAdmin)) {
				userData.ips = results.ips;
			}

			if (!isAdmin && !isGlobalModerator && !isModerator) {
				userData.moderationNote = undefined;
			}

			userData.isBlocked = results.isBlocked;
			if (isAdmin || isSelf) {
				userData.blocksCount = parseInt(userData.blocksCount, 10) || 0;
			}

			userData.yourid = callerUID;
			userData.theirid = userData.uid;
			userData.isTargetAdmin = results.isTargetAdmin;
			userData.isAdmin = isAdmin;
			userData.isGlobalModerator = isGlobalModerator;
			userData.isModerator = isModerator;
			userData.isAdminOrGlobalModerator = isAdmin || isGlobalModerator;
			userData.isAdminOrGlobalModeratorOrModerator = isAdmin || isGlobalModerator || isModerator;
			userData.isSelfOrAdminOrGlobalModerator = isSelf || isAdmin || isGlobalModerator;
			userData.canEdit = results.canEdit;
			userData.canBan = results.canBanUser;
			userData.canChangePassword = isAdmin || (isSelf && !meta.config['password:disableEdit']);
			userData.isSelf = isSelf;
			userData.isFollowing = results.isFollowing;
			userData.showHidden = isSelf || isAdmin || (isGlobalModerator && !results.isTargetAdmin);
			userData.groups = Array.isArray(results.groups) && results.groups.length ? results.groups[0] : [];
			userData.disableSignatures = meta.config.disableSignatures === 1;
			userData['reputation:disabled'] = meta.config['reputation:disabled'] === 1;
			userData['downvote:disabled'] = meta.config['downvote:disabled'] === 1;
			userData['email:confirmed'] = !!userData['email:confirmed'];
			userData.profile_links = filterLinks(results.profile_menu.links, {
				self: isSelf,
				other: !isSelf,
				moderator: isModerator,
				globalMod: isGlobalModerator,
				admin: isAdmin,
			});

			userData.sso = results.sso.associations;
			userData.status = user.getStatus(userData);
			userData.banned = userData.banned === 1;
			userData.website = validator.escape(String(userData.website || ''));
			userData.websiteLink = !userData.website.startsWith('http') ? 'http://' + userData.website : userData.website;
			userData.websiteName = userData.website.replace(validator.escape('http://'), '').replace(validator.escape('https://'), '');

			userData.fullname = validator.escape(String(userData.fullname || ''));
			userData.location = validator.escape(String(userData.location || ''));
			userData.signature = validator.escape(String(userData.signature || ''));
			userData.aboutme = validator.escape(String(userData.aboutme || ''));
			userData.birthday = validator.escape(String(userData.birthday || ''));
			userData.moderationNote = validator.escape(String(userData.moderationNote || ''));

			if (userData['cover:url']) {
				userData['cover:url'] = userData['cover:url'].startsWith('http') ? userData['cover:url'] : (nconf.get('relative_path') + userData['cover:url']);
			} else {
				userData['cover:url'] = require('../../coverPhoto').getDefaultProfileCover(userData.uid);
			}

			userData['cover:position'] = validator.escape(String(userData['cover:position'] || '50% 50%'));
			userData['username:disableEdit'] = !userData.isAdmin && meta.config['username:disableEdit'];
			userData['email:disableEdit'] = !userData.isAdmin && meta.config['email:disableEdit'];

			next(null, userData);
		},
	], callback);
};

function filterLinks(links, states) {
	return links.filter(function (link, index) {
		// "public" is the old property, if visibility is defined, discard `public`
		if (link.hasOwnProperty('public') && !link.hasOwnProperty('visibility')) {
			winston.warn('[account/profileMenu (' + link.id + ')] Use of the `.public` property is deprecated, use `visibility` now');
			return link && (link.public || states.self);
		}

		// Default visibility
		link.visibility = Object.assign({
			self: true,
			other: true,
			moderator: true,
			globalMod: true,
			admin: true,
		}, link.visibility);

		var permit = Object.keys(states).some(function (state) {
			return states[state] && link.visibility[state];
		});

		links[index].public = permit;
		return permit;
	});
}
