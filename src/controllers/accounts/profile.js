'use strict';

var nconf = require('nconf');
var async = require('async');

const db = require('../../database');
var user = require('../../user');
var posts = require('../../posts');
const categories = require('../../categories');
var plugins = require('../../plugins');
var meta = require('../../meta');
var accountHelpers = require('./helpers');
var helpers = require('../helpers');
var messaging = require('../../messaging');
var utils = require('../../utils');

var profileController = module.exports;

profileController.get = function (req, res, callback) {
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

			if (req.uid >= 0) {
				req.session.uids_viewed = req.session.uids_viewed || {};

				if (req.uid !== userData.uid && (!req.session.uids_viewed[userData.uid] || req.session.uids_viewed[userData.uid] < Date.now() - 3600000)) {
					user.incrementUserFieldBy(userData.uid, 'profileviews', 1);
					req.session.uids_viewed[userData.uid] = Date.now();
				}
			}

			async.parallel({
				hasPrivateChat: function (next) {
					messaging.hasPrivateChat(req.uid, userData.uid, next);
				},
				latestPosts: function (next) {
					getLatestPosts(req.uid, userData, next);
				},
				bestPosts: function (next) {
					getBestPosts(req.uid, userData, next);
				},
				signature: function (next) {
					posts.parseSignature(userData, req.uid, next);
				},
			}, next);
		},
		function (results, next) {
			if (meta.config['reputation:disabled']) {
				delete userData.reputation;
			}

			userData.posts = results.latestPosts; // for backwards compat.
			userData.latestPosts = results.latestPosts;
			userData.bestPosts = results.bestPosts;
			userData.hasPrivateChat = results.hasPrivateChat;
			userData.breadcrumbs = helpers.buildBreadcrumbs([{ text: userData.username }]);
			userData.title = userData.username;
			userData.allowCoverPicture = !userData.isSelf || !!meta.config['reputation:disabled'] || userData.reputation >= meta.config['min:rep:cover-picture'];

			if (!userData.profileviews) {
				userData.profileviews = 1;
			}

			addMetaTags(res, userData);

			userData.selectedGroup = userData.groups.filter(function (group) {
				return group && userData.groupTitleArray.includes(group.name);
			});

			plugins.fireHook('filter:user.account', { userData: userData, uid: req.uid }, next);
		},
		function (results) {
			res.render('account/profile', results.userData);
		},
	], callback);
};

function getLatestPosts(callerUid, userData, callback) {
	getPosts(callerUid, userData, 'pids', callback);
}

function getBestPosts(callerUid, userData, callback) {
	getPosts(callerUid, userData, 'pids:votes', callback);
}

function getPosts(callerUid, userData, setSuffix, callback) {
	async.waterfall([
		function (next) {
			categories.getCidsByPrivilege('categories:cid', callerUid, 'topics:read', next);
		},
		function (cids, next) {
			const keys = cids.map(c => 'cid:' + c + ':uid:' + userData.uid + ':' + setSuffix);
			db.getSortedSetRevRange(keys, 0, 9, next);
		},
		function (pids, next) {
			posts.getPostSummaryByPids(pids, callerUid, { stripTags: false }, next);
		},
		function (posts, next) {
			posts = posts.filter(p => p && !p.deleted);
			next(null, posts);
		},
	], callback);
}

function addMetaTags(res, userData) {
	var plainAboutMe = userData.aboutme ? utils.stripHTMLTags(utils.decodeHTMLEntities(userData.aboutme)) : '';
	res.locals.metaTags = [
		{
			name: 'title',
			content: userData.fullname || userData.username,
		},
		{
			name: 'description',
			content: plainAboutMe,
		},
		{
			property: 'og:title',
			content: userData.fullname || userData.username,
		},
		{
			property: 'og:description',
			content: plainAboutMe,
		},
	];

	if (userData.picture) {
		res.locals.metaTags.push(
			{
				property: 'og:image',
				content: userData.picture,
				noEscape: true,
			},
			{
				property: 'og:image:url',
				content: userData.picture,
				noEscape: true,
			}
		);
	}
}
