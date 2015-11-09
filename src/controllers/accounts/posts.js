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
	getFromUserSet('account/favourites', 'favourites', '[[user:favourites]]', posts.getPostSummariesFromSet, 'posts', req, res, next);
};

postsController.getPosts = function(req, res, next) {
	getFromUserSet('account/posts', 'posts', '[[global:posts]]', posts.getPostSummariesFromSet, 'posts', req, res, next);
};

postsController.getWatchedTopics = function(req, res, next) {
	getFromUserSet('account/watched', 'followed_tids', '[[user:watched]]',topics.getTopicsFromSet, 'topics', req, res, next);
};

postsController.getTopics = function(req, res, next) {
	getFromUserSet('account/topics', 'topics', '[[global:topics]]', topics.getTopicsFromSet, 'topics', req, res, next);
};

function getFromUserSet(tpl, set, crumb, method, type, req, res, next) {
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

		var setName = 'uid:' + userData.uid + ':' + set;

		var page = Math.max(1, parseInt(req.query.page, 10) || 1);
		var itemsPerPage = (tpl === 'account/topics' || tpl === 'account/watched') ? results.settings.topicsPerPage : results.settings.postsPerPage;

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
				method(setName, req.uid, start, stop, next);
			}
		}, function(err, results) {
			if (err) {
				return next(err);
			}

			userData[type] = results.data[type];
			userData.nextStart = results.data.nextStart;

			var pageCount = Math.ceil(results.itemCount / itemsPerPage);
			userData.pagination = pagination.create(page, pageCount);

			userData.title = '[[pages:' + tpl + ', ' + userData.username + ']]';
			userData.breadcrumbs = helpers.buildBreadcrumbs([{text: userData.username, url: '/user/' + userData.userslug}, {text: crumb}]);

			res.render(tpl, userData);
		});
	});
}

module.exports = postsController;