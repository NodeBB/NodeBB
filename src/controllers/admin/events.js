'use strict';

var async = require('async');

var db = require('../../database');
var events = require('../../events');
var pagination = require('../../pagination');

var eventsController = module.exports;

eventsController.get = function (req, res, next) {
	var page = parseInt(req.query.page, 10) || 1;
	var itemsPerPage = 20;
	var start = (page - 1) * itemsPerPage;
	var stop = start + itemsPerPage - 1;

	var currentFilter = req.query.filter || '';

	async.waterfall([
		function (next) {
			async.parallel({
				eventCount: function (next) {
					db.sortedSetCard('events:time' + (currentFilter ? ':' + currentFilter : ''), next);
				},
				events: function (next) {
					events.getEvents(currentFilter, start, stop, next);
				},
			}, next);
		},
		function (results) {
			var types = [''].concat(events.types);
			var filters = types.map(function (type) {
				return {
					value: type,
					name: type || 'all',
					selected: type === currentFilter,
				};
			});

			var pageCount = Math.max(1, Math.ceil(results.eventCount / itemsPerPage));

			res.render('admin/advanced/events', {
				events: results.events,
				pagination: pagination.create(page, pageCount, req.query),
				filters: filters,
			});
		},
	], next);
};
