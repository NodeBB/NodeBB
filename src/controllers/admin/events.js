'use strict';

var async = require('async');

var db = require('../../database');
var events = require('../../events');
var pagination = require('../../pagination');

var eventsController = module.exports;

eventsController.get = function (req, res, next) {
	var page = parseInt(req.query.page, 10) || 1;
	var itemsPerPage = parseInt(req.query.perPage, 10) || 20;
	var start = (page - 1) * itemsPerPage;
	var stop = start + itemsPerPage - 1;

	// Limit by date
	var from = req.query.start ? new Date(req.query.start) || undefined : undefined;
	var to = req.query.end ? new Date(req.query.end) || undefined : new Date();
	from = from && from.setHours(0, 0, 0, 0);	// setHours returns a unix timestamp (Number, not Date)
	to = to && to.setHours(23, 59, 59, 999);	// setHours returns a unix timestamp (Number, not Date)

	var currentFilter = req.query.type || '';

	async.waterfall([
		function (next) {
			async.parallel({
				eventCount: function (next) {
					db.sortedSetCount('events:time' + (currentFilter ? ':' + currentFilter : ''), from || '-inf', to, next);
				},
				events: function (next) {
					events.getEvents(currentFilter, start, stop, from || '-inf', to, next);
				},
			}, next);
		},
		function (results) {
			var types = [''].concat(events.types).map(function (type) {
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
				types: types,
				query: req.query,
			});
		},
	], next);
};
