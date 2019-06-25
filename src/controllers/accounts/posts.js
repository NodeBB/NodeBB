'use strict';


var async = require('async');

var db = require('../../database');
var user = require('../../user');
var posts = require('../../posts');
var topics = require('../../topics');
var categories = require('../../categories');
var pagination = require('../../pagination');
var helpers = require('../helpers');
var accountHelpers = require('./helpers');

var postsController = module.exports;

var templateToData = {
	'account/bookmarks': {
		type: 'posts',
		noItemsFoundKey: '[[topic:bookmarks.has_no_bookmarks]]',
		crumb: '[[user:bookmarks]]',
		getSets: function (callerUid, userData, calback) {
			setImmediate(calback, null, 'uid:' + userData.uid + ':bookmarks');
		},
	},
	'account/posts': {
		type: 'posts',
		noItemsFoundKey: '[[user:has_no_posts]]',
		crumb: '[[global:posts]]',
		getSets: function (callerUid, userData, callback) {
			async.waterfall([
				function (next) {
					categories.getCidsByPrivilege('categories:cid', callerUid, 'topics:read', next);
				},
				function (cids, next) {
					next(null, cids.map(c => 'cid:' + c + ':uid:' + userData.uid + ':pids'));
				},
			], callback);
		},
	},
	'account/upvoted': {
		type: 'posts',
		noItemsFoundKey: '[[user:has_no_upvoted_posts]]',
		crumb: '[[global:upvoted]]',
		getSets: function (callerUid, userData, calback) {
			setImmediate(calback, null, 'uid:' + userData.uid + ':upvote');
		},
	},
	'account/downvoted': {
		type: 'posts',
		noItemsFoundKey: '[[user:has_no_downvoted_posts]]',
		crumb: '[[global:downvoted]]',
		getSets: function (callerUid, userData, calback) {
			setImmediate(calback, null, 'uid:' + userData.uid + ':downvote');
		},
	},
	'account/best': {
		type: 'posts',
		noItemsFoundKey: '[[user:has_no_voted_posts]]',
		crumb: '[[global:best]]',
		getSets: function (callerUid, userData, callback) {
			async.waterfall([
				function (next) {
					categories.getCidsByPrivilege('categories:cid', callerUid, 'topics:read', next);
				},
				function (cids, next) {
					next(null, cids.map(c => 'cid:' + c + ':uid:' + userData.uid + ':pids:votes'));
				},
			], callback);
		},
	},
	'account/watched': {
		type: 'topics',
		noItemsFoundKey: '[[user:has_no_watched_topics]]',
		crumb: '[[user:watched]]',
		getSets: function (callerUid, userData, calback) {
			setImmediate(calback, null, 'uid:' + userData.uid + ':followed_tids');
		},
		getTopics: function (set, req, start, stop, callback) {
			const sort = req.query.sort;
			const map = {
				votes: 'topics:votes',
				posts: 'topics:posts',
				views: 'topics:views',
				lastpost: 'topics:recent',
				firstpost: 'topics:tid',
			};

			if (!sort || !map[sort]) {
				return topics.getTopicsFromSet(set, req.uid, start, stop, callback);
			}
			const sortSet = map[sort];
			let tids;
			async.waterfall([
				function (next) {
					db.getSortedSetRevRange(set, 0, -1, next);
				},
				function (_tids, next) {
					tids = _tids;
					db.sortedSetScores(sortSet, tids, next);
				},
				function (scores, next) {
					tids = tids.map((tid, i) => ({ tid: tid, score: scores[i] }))
						.sort((a, b) => b.score - a.score)
						.slice(start, stop + 1)
						.map(t => t.tid);

					topics.getTopics(tids, req.uid, next);
				},
				function (topicsData, next) {
					topics.calculateTopicIndices(topicsData, start);
					next(null, { topics: topicsData, nextStart: stop + 1 });
				},
			], callback);
		},
	},
	'account/ignored': {
		type: 'topics',
		noItemsFoundKey: '[[user:has_no_ignored_topics]]',
		crumb: '[[user:ignored]]',
		getSets: function (callerUid, userData, calback) {
			setImmediate(calback, null, 'uid:' + userData.uid + ':ignored_tids');
		},
	},
	'account/topics': {
		type: 'topics',
		noItemsFoundKey: '[[user:has_no_topics]]',
		crumb: '[[global:topics]]',
		getSets: function (callerUid, userData, callback) {
			async.waterfall([
				function (next) {
					categories.getCidsByPrivilege('categories:cid', callerUid, 'topics:read', next);
				},
				function (cids, next) {
					next(null, cids.map(c => 'cid:' + c + ':uid:' + userData.uid + ':tids'));
				},
			], callback);
		},
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
	var userData;
	var settings;
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
			settings = results.settings;
			itemsPerPage = data.type === 'topics' ? settings.topicsPerPage : settings.postsPerPage;

			data.getSets(req.uid, userData, next);
		},
		function (sets, next) {
			async.parallel({
				itemCount: function (next) {
					if (settings.usePagination) {
						db.sortedSetsCardSum(sets, next);
					} else {
						next(null, 0);
					}
				},
				data: function (next) {
					var start = (page - 1) * itemsPerPage;
					var stop = start + itemsPerPage - 1;
					const method = data.type === 'topics' ? topics.getTopicsFromSet : posts.getPostSummariesFromSet;
					if (data.getTopics) {
						return data.getTopics(sets, req, start, stop, next);
					}
					method(sets, req.uid, start, stop, next);
				},
			}, next);
		},
		function (results) {
			userData[data.type] = results.data[data.type];
			userData.nextStart = results.data.nextStart;

			var pageCount = Math.ceil(results.itemCount / itemsPerPage);
			userData.pagination = pagination.create(page, pageCount, req.query);

			userData.noItemsFoundKey = data.noItemsFoundKey;
			userData.title = '[[pages:' + template + ', ' + userData.username + ']]';
			userData.breadcrumbs = helpers.buildBreadcrumbs([{ text: userData.username, url: '/user/' + userData.userslug }, { text: data.crumb }]);
			userData.showSort = template === 'account/watched';
			const baseUrl = (req.baseUrl + req.path.replace(/^\/api/, ''));
			userData.sortOptions = [
				{ url: baseUrl + '?sort=votes', name: '[[global:votes]]' },
				{ url: baseUrl + '?sort=posts', name: '[[global:posts]]' },
				{ url: baseUrl + '?sort=views', name: '[[global:views]]' },
				{ url: baseUrl + '?sort=lastpost', name: '[[global:lastpost]]' },
				{ url: baseUrl + '?sort=firstpost', name: '[[global:firstpost]]' },
			];
			userData.sortOptions.forEach(function (option) {
				option.selected = option.url.includes('sort=' + req.query.sort);
			});

			res.render(template, userData);
		},
	], callback);
}
