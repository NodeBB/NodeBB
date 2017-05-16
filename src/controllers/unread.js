
'use strict';

var async = require('async');
var querystring = require('querystring');
var validator = require('validator');

var pagination = require('../pagination');
var user = require('../user');
var topics = require('../topics');
var plugins = require('../plugins');
var helpers = require('./helpers');

var unreadController = module.exports;

var validFilter = { '': true, new: true, watched: true };

unreadController.get = function (req, res, next) {
	var page = parseInt(req.query.page, 10) || 1;
	var results;
	var cid = req.query.cid;
	var filter = req.params.filter || '';
	var settings;

	async.waterfall([
		function (next) {
			plugins.fireHook('filter:unread.getValidFilters', { filters: validFilter }, next);
		},
		function (data, _next) {
			if (!data.filters[filter]) {
				return next();
			}

			async.parallel({
				watchedCategories: function (next) {
					helpers.getWatchedCategories(req.uid, cid, next);
				},
				settings: function (next) {
					user.getSettings(req.uid, next);
				},
			}, _next);
		},
		function (_results, next) {
			results = _results;
			settings = results.settings;
			var start = Math.max(0, (page - 1) * settings.topicsPerPage);
			var stop = start + settings.topicsPerPage - 1;
			var cutoff = req.session.unreadCutoff ? req.session.unreadCutoff : topics.unreadCutoff();
			topics.getUnreadTopics({
				cid: cid,
				uid: req.uid,
				start: start,
				stop: stop,
				filter: filter,
				cutoff: cutoff,
			}, next);
		},
	], function (err, data) {
		if (err) {
			return next(err);
		}

		data.pageCount = Math.max(1, Math.ceil(data.topicCount / settings.topicsPerPage));
		data.pagination = pagination.create(page, data.pageCount, req.query);

		if (settings.usePagination && (page < 1 || page > data.pageCount)) {
			req.query.page = Math.max(1, Math.min(data.pageCount, page));
			return helpers.redirect(res, '/unread?' + querystring.stringify(req.query));
		}

		data.categories = results.watchedCategories.categories;
		data.selectedCategory = results.watchedCategories.selectedCategory;

		if (req.path.startsWith('/api/unread') || req.path.startsWith('/unread')) {
			data.breadcrumbs = helpers.buildBreadcrumbs([{ text: '[[unread:title]]' }]);
		}

		data.title = '[[pages:unread]]';
		data.filters = [{
			name: '[[unread:all-topics]]',
			url: 'unread',
			selected: filter === '',
			filter: '',
		}, {
			name: '[[unread:new-topics]]',
			url: 'unread/new',
			selected: filter === 'new',
			filter: 'new',
		}, {
			name: '[[unread:watched-topics]]',
			url: 'unread/watched',
			selected: filter === 'watched',
			filter: 'watched',
		}];

		data.selectedFilter = data.filters.find(function (filter) {
			return filter && filter.selected;
		});

		data.querystring = cid ? ('?cid=' + validator.escape(String(cid))) : '';

		res.render('unread', data);
	});
};

unreadController.unreadTotal = function (req, res, next) {
	var filter = req.params.filter || '';

	if (!validFilter[filter]) {
		return next();
	}

	topics.getTotalUnread(req.uid, filter, function (err, data) {
		if (err) {
			return next(err);
		}

		res.json(data);
	});
};
