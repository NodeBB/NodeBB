"use strict";

var eventEmitter = new (require('events')).EventEmitter();


eventEmitter.all = function(events, callback) {
	function onEvent(event) {
		eventEmitter.on(events[event], function() {
			events.splice(events.indexOf(event), 1);

			if (events.length === 0) {
				callback();
			}
		});
	}

	for (var ev in events) {
		if (events.hasOwnProperty(ev)) {
			onEvent(ev);
		}
	}
};

eventEmitter.any = function(events, callback) {
	function onEvent(event) {
		eventEmitter.on(events[event], function() {
			if (events !== null) {
				callback();
			}

			events = null;
		});
	}

	for (var ev in events) {
		if (events.hasOwnProperty(ev)) {
			onEvent(ev);
		}
	}
};

module.exports = eventEmitter;