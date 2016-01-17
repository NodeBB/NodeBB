'use strict';


var async = require('async'),

	db = require('../../database'),
	user = require('../../user'),
	posts = require('../../posts'),
	topics = require('../../topics'),
	pagination = require('../../pagination'),
	helpers = require('../helpers'),
	accountHelpers = require('./helpers');

var postsController = {};

postsController.getFavourites = function(req, res, next) {
	var data = {
		template: 'account/favourites',
		set: 'favourites',
		type: 'posts',
		noItemsFoundKey: '[[topic:favourites.has_no_favourites]]',
		method: posts.getPostSummariesFromSet,
		crumb: '[[user:favourites]]'
	};
	getFromUserSet(data, req, res, next);
};

postsController.getPosts = function(req, res, next) {
	var data = {
		template: 'account/posts',
		set: 'posts',
		type: 'posts',
		noItemsFoundKey: '[[user:has_no_posts]]',
		method: posts.getPostSummariesFromSet,
		crumb: '[[global:posts]]'
	};
	getFromUserSet(data, req, res, next);
};

postsController.getUpVotedPosts = function(req, res, next) {
	var data = {
		template: 'account/upvoted',
		set: 'upvote',
		type: 'posts',
		noItemsFoundKey: '[[user:has_no_upvoted_posts]]',
		method: posts.getPostSummariesFromSet,
		crumb: '[[global:upvoted]]'
	};
	getFromUserSet(data, req, res, next);
};

postsController.getDownVotedPosts = function(req, res, next) {
	var data = {
		template: 'account/downvoted',
		set: 'downvote',
		type: 'posts',
		noItemsFoundKey: '[[user:has_no_downvoted_posts]]',
		method: posts.getPostSummariesFromSet,
		crumb: '[[global:downvoted]]'
	};
	getFromUserSet(data, req, res, next);
};

postsController.getBestPosts = function(req, res, next) {
	var data = {
		template: 'account/best',
		set: 'posts:votes',
		type: 'posts',
		noItemsFoundKey: '[[user:has_no_voted_posts]]',
		method: posts.getPostSummariesFromSet,
		crumb: '[[global:best]]'
	};
	getFromUserSet(data, req, res, next);
};

postsController.getWatchedTopics = function(req, res, next) {
	var data = {
		template: 'account/watched',
		set: 'followed_tids',
		type: 'topics',
		noItemsFoundKey: '[[user:has_no_watched_topics]]',
		method: topics.getTopicsFromSet,
		crumb: '[[user:watched]]'
	};
	getFromUserSet(data, req, res, next);
};

postsController.getTopics = function(req, res, next) {
	var data = {
		template: 'account/topics',
		set: 'topics',
		type: 'topics',
		noItemsFoundKey: '[[user:has_no_topics]]',
		method: topics.getTopicsFromSet,
		crumb: '[[global:topics]]'
	};
	getFromUserSet(data, req, res, next);
};

function getFromUserSet(data, req, res, next) {
	async.parallel({
		settings: function(next) {
			user.getSettings(req.uid, next);
		},
		userData: function(next) {
			accountHelpers.getBaseUser(req.params.userslug, req.uid, next);
		}
	}, function(err, results) {
		if (err || !results.userData) {
			return next(err);
		}

		var userData = results.userData;

		var setName = 'uid:' + userData.uid + ':' + data.set;

		var page = Math.max(1, parseInt(req.query.page, 10) || 1);
		var itemsPerPage = (data.template === 'account/topics' || data.template === 'account/watched') ? results.settings.topicsPerPage : results.settings.postsPerPage;

		async.parallel({
			itemCount: function(next) {
				if (results.settings.usePagination) {
					db.sortedSetCard(setName, next);
				} else {
					next(null, 0);
				}
			},
			data: function(next) {
				var start = (page - 1) * itemsPerPage;
				var stop = start + itemsPerPage - 1;
				data.method(setName, req.uid, start, stop, next);
			}
		}, function(err, results) {
			if (err) {
				return next(err);
			}

			userData[data.type] = results.data[data.type];
			userData.nextStart = results.data.nextStart;

			var pageCount = Math.ceil(results.itemCount / itemsPerPage);
			userData.pagination = pagination.create(page, pageCount);

			userData.noItemsFoundKey = data.noItemsFoundKey;
			userData.title = '[[pages:' + data.template + ', ' + userData.username + ']]';
			userData.breadcrumbs = helpers.buildBreadcrumbs([{text: userData.username, url: '/user/' + userData.userslug}, {text: data.crumb}]);

			res.render(data.template, userData);
		});
	});
}

module.exports = postsController;