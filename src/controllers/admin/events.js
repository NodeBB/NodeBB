'use strict';

var events = require('../../events');

var eventsController = {};


eventsController.get = function(req, res, next) {
	events.getEvents(0, 19, function(err, events) {
		if (err) {
			return next(err);
		}

		res.render('admin/advanced/events', {
			events: events,
			next: 20
		});
	});
};


module.exports = eventsController;