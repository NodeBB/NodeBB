'use strict';


var async = require('async');

var db = require('../../database');
var user = require('../../user');
var posts = require('../../posts');
var topics = require('../../topics');
var pagination = require('../../pagination');
var helpers = require('../helpers');
var accountHelpers = require('./helpers');

var postsController = module.exports;

var templateToData = {
	'account/bookmarks': {
		set: 'bookmarks',
		type: 'posts',
		noItemsFoundKey: '[[topic:bookmarks.has_no_bookmarks]]',
		crumb: '[[user:bookmarks]]',
	},
	'account/posts': {
		set: 'posts',
		type: 'posts',
		noItemsFoundKey: '[[user:has_no_posts]]',
		crumb: '[[global:posts]]',
	},
	'account/upvoted': {
		set: 'upvote',
		type: 'posts',
		noItemsFoundKey: '[[user:has_no_upvoted_posts]]',
		crumb: '[[global:upvoted]]',
	},
	'account/downvoted': {
		set: 'downvote',
		type: 'posts',
		noItemsFoundKey: '[[user:has_no_downvoted_posts]]',
		crumb: '[[global:downvoted]]',
	},
	'account/best': {
		set: 'posts:votes',
		type: 'posts',
		noItemsFoundKey: '[[user:has_no_voted_posts]]',
		crumb: '[[global:best]]',
	},
	'account/watched': {
		set: 'followed_tids',
		type: 'topics',
		noItemsFoundKey: '[[user:has_no_watched_topics]]',
		crumb: '[[user:watched]]',
	},
	'account/ignored': {
		set: 'ignored_tids',
		type: 'topics',
		noItemsFoundKey: '[[user:has_no_ignored_topics]]',
		crumb: '[[user:ignored]]',
	},
	'account/topics': {
		set: 'topics',
		type: 'topics',
		noItemsFoundKey: '[[user:has_no_topics]]',
		crumb: '[[global:topics]]',
	},
};

postsController.getBookmarks = function (req, res, next) {
	getFromUserSet('account/bookmarks', req, res, next);
};

postsController.getPosts = function (req, res, next) {
	getFromUserSet('account/posts', req, res, next);
};

postsController.getUpVotedPosts = function (req, res, next) {
	getFromUserSet('account/upvoted', req, res, next);
};

postsController.getDownVotedPosts = function (req, res, next) {
	getFromUserSet('account/downvoted', req, res, next);
};

postsController.getBestPosts = function (req, res, next) {
	getFromUserSet('account/best', req, res, next);
};

postsController.getWatchedTopics = function (req, res, next) {
	getFromUserSet('account/watched', req, res, next);
};

postsController.getIgnoredTopics = function (req, res, next) {
	getFromUserSet('account/ignored', req, res, next);
};

postsController.getTopics = function (req, res, next) {
	getFromUserSet('account/topics', req, res, next);
};

function getFromUserSet(template, req, res, callback) {
	var data = templateToData[template];
	data.template = template;
	data.method = data.type === 'posts' ? posts.getPostSummariesFromSet : topics.getTopicsFromSet;
	var userData;
	var itemsPerPage;
	var page = Math.max(1, parseInt(req.query.page, 10) || 1);

	async.waterfall([
		function (next) {
			async.parallel({
				settings: function (next) {
					user.getSettings(req.uid, next);
				},
				userData: function (next) {
					accountHelpers.getUserDataByUserSlug(req.params.userslug, req.uid, next);
				},
			}, next);
		},
		function (results, next) {
			if (!results.userData) {
				return callback();
			}

			userData = results.userData;

			var setName = 'uid:' + userData.uid + ':' + data.set;

			itemsPerPage = (data.template === 'account/topics' || data.template === 'account/watched') ? results.settings.topicsPerPage : results.settings.postsPerPage;

			async.parallel({
				itemCount: function (next) {
					if (results.settings.usePagination) {
						db.sortedSetCard(setName, next);
					} else {
						next(null, 0);
					}
				},
				data: function (next) {
					var start = (page - 1) * itemsPerPage;
					var stop = start + itemsPerPage - 1;
					data.method(setName, req.uid, start, stop, next);
				},
			}, next);
		},
		function (results) {
			userData[data.type] = results.data[data.type];
			userData.nextStart = results.data.nextStart;

			var pageCount = Math.ceil(results.itemCount / itemsPerPage);
			userData.pagination = pagination.create(page, pageCount);

			userData.noItemsFoundKey = data.noItemsFoundKey;
			userData.title = '[[pages:' + data.template + ', ' + userData.username + ']]';
			userData.breadcrumbs = helpers.buildBreadcrumbs([{ text: userData.username, url: '/user/' + userData.userslug }, { text: data.crumb }]);

			res.render(data.template, userData);
		},
	], callback);
}

module.exports = postsController;
