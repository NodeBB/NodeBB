'use strict';

var nconf = require('nconf'),
	async = require('async'),

	user = require('../../user'),
	posts = require('../../posts'),
	plugins = require('../../plugins'),
	meta = require('../../meta'),
	accountHelpers = require('./helpers'),
	helpers = require('../helpers');


var profileController = {};

profileController.get = function(req, res, callback) {
	var lowercaseSlug = req.params.userslug.toLowerCase();

	if (req.params.userslug !== lowercaseSlug) {
		if (res.locals.isAPI) {
			req.params.userslug = lowercaseSlug;
		} else {
			return res.redirect(nconf.get('relative_path') + '/user/' + lowercaseSlug);
		}
	}

	var userData;
	async.waterfall([
		function (next) {
			accountHelpers.getUserDataByUserSlug(req.params.userslug, req.uid, next);
		},
		function (_userData, next) {
			if (!_userData) {
				return callback();
			}
			userData = _userData;

			if (req.uid !== parseInt(userData.uid, 10)) {
				user.incrementUserFieldBy(userData.uid, 'profileviews', 1);
			}

			async.parallel({
				isFollowing: function(next) {
					user.isFollowing(req.uid, userData.theirid, next);
				},
				posts: function(next) {
					posts.getPostSummariesFromSet('uid:' + userData.theirid + ':posts', req.uid, 0, 9, next);
				},
				signature: function(next) {
					posts.parseSignature(userData, req.uid, next);
				},
				aboutme: function(next) {
					if (userData.aboutme) {
						plugins.fireHook('filter:parse.raw', userData.aboutme, next);
					} else {
						next();
					}
				}
			}, next);
		},
		function (results, next) {
			if (parseInt(meta.config['reputation:disabled'], 10) === 1) {
				delete userData.reputation;
			}

			userData.posts = results.posts.posts.filter(function (p) {
				return p && parseInt(p.deleted, 10) !== 1;
			});

			userData.aboutme = results.aboutme;
			userData.nextStart = results.posts.nextStart;
			userData.isFollowing = results.isFollowing;
			userData.breadcrumbs = helpers.buildBreadcrumbs([{text: userData.username}]);
			userData.title = userData.username;

			userData['cover:url'] = userData['cover:url'] || require('../../coverPhoto').getDefaultProfileCover(userData.uid);
			userData['cover:position'] = userData['cover:position'] || '50% 50%';

			if (!userData.profileviews) {
				userData.profileviews = 1;
			}

			plugins.fireHook('filter:user.account', {userData: userData, uid: req.uid}, next);
		}
	], function(err, results) {
		if (err) {
			return callback(err);
		}
		res.render('account/profile', results.userData);
	});
};

module.exports = profileController;