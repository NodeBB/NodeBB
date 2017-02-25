'use strict';

var eventEmitter = new (require('events')).EventEmitter();


eventEmitter.all = function (events, callback) {
	var eventList = events.slice(0);

	events.forEach(function onEvent(event) {
		eventEmitter.on(event, function () {
			var index = eventList.indexOf(event);
			if (index === -1) {
				return;
			}
			eventList.splice(index, 1);
			if (eventList.length === 0) {
				callback();
			}
		});
	});
};

eventEmitter.any = function (events, callback) {
	events.forEach(function onEvent(event) {
		eventEmitter.on(event, function () {
			if (events !== null) {
				callback();
			}

			events = null;
		});
	});
};

module.exports = eventEmitter;
