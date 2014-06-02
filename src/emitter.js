"use strict";

var events = require('events'),
	eventEmitter = new events.EventEmitter();


eventEmitter.all = function(events, callback) {
	for (var ev in events) {
		if (events.hasOwnProperty(ev)) {
			(function(ev) {
				eventEmitter.on(events[ev], function() {
					events.splice(events.indexOf(ev), 1);

					if (events.length === 0) {
						callback();
					}
				});
			}(ev));
		}
	}
};

module.exports = eventEmitter;