'use strict';

var async = require('async');

var user = require('../../user');
var helpers = require('../helpers');
var plugins = require('../../plugins');
var pagination = require('../../pagination');

var notificationsController = module.exports;

notificationsController.get = function (req, res, next) {
	var regularFilters = [
		{ name: '[[notifications:all]]', filter: '' },
		{ name: '[[global:topics]]', filter: 'new-topic' },
		{ name: '[[notifications:replies]]', filter: 'new-reply' },
		{ name: '[[notifications:chat]]', filter: 'new-chat' },
		{ name: '[[notifications:follows]]', filter: 'follow' },
		{ name: '[[notifications:upvote]]', filter: 'upvote' },
	];

	var moderatorFilters = [
		{ name: '[[notifications:new-flags]]', filter: 'new-post-flag' },
		{ name: '[[notifications:my-flags]]', filter: 'my-flags' },
		{ name: '[[notifications:bans]]', filter: 'ban' },
	];

	var filter = req.query.filter || '';
	var page = Math.max(1, req.query.page || 1);
	var itemsPerPage = 20;
	var start = (page - 1) * itemsPerPage;
	var stop = start + itemsPerPage - 1;
	var selectedFilter;
	var pageCount = 1;
	var allFilters = [];

	async.waterfall([
		function (next) {
			async.parallel({
				filters: function (next) {
					plugins.fireHook('filter:notifications.addFilters', {
						regularFilters: regularFilters,
						moderatorFilters: moderatorFilters,
						uid: req.uid,
					}, next);
				},
				isPrivileged: function (next) {
					user.isPrivileged(req.uid, next);
				},
			}, next);
		},
		function (data, _next) {
			allFilters = data.filters.regularFilters;

			if (data.isPrivileged) {
				allFilters = allFilters.concat([
					{ separator: true },
				]).concat(data.filters.moderatorFilters);
			}

			selectedFilter = allFilters.find(function (filterData) {
				filterData.selected = filterData.filter === filter;
				return filterData.selected;
			});

			if (!selectedFilter) {
				return next();
			}

			user.notifications.getAll(req.uid, selectedFilter.filter, _next);
		},
		function (nids, next) {
			pageCount = Math.max(1, Math.ceil(nids.length / itemsPerPage));
			nids = nids.slice(start, stop + 1);

			user.notifications.getNotifications(nids, req.uid, next);
		},
		function (notifications, next) {
			plugins.fireHook('filter:notifications.get', {
				notifications: notifications,
			}, function (err, data) {
				if (err) {
					return next(err);
				}

				next(null, data.notifications);
			});
		},
		function (notifications) {
			res.render('notifications', {
				notifications: notifications,
				pagination: pagination.create(page, pageCount, req.query),
				filters: allFilters,
				regularFilters: regularFilters,
				moderatorFilters: moderatorFilters,
				selectedFilter: selectedFilter,
				title: '[[pages:notifications]]',
				breadcrumbs: helpers.buildBreadcrumbs([{ text: '[[pages:notifications]]' }]),
			});
		},
	], next);
};
