'use strict';


define('admin/advanced/events', function () {
	var	Events = {};

	Events.init = function () {
		$('#apply').on('click', Events.refresh);
	};

	Events.refresh = function (event) {
		event.preventDefault();

		var formEl = $('#filters');
		ajaxify.go('admin/advanced/events?' + formEl.serialize());
	};

	return Events;
});
