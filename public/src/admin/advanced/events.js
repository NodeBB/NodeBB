'use strict';


define('admin/advanced/events', function () {
	var	Events = {};

	Events.init = function () {
		$('[data-action="clear"]').on('click', function () {
			socket.emit('admin.deleteAllEvents', function (err) {
				if (err) {
					return app.alertError(err.message);
				}
				$('.events-list').empty();
			});
		});

		$('.delete-event').on('click', function () {
			var parentEl = $(this).parents('[data-eid]');
			var eid = parentEl.attr('data-eid');
			socket.emit('admin.deleteEvents', [eid], function (err) {
				if (err) {
					return app.alertError(err.message);
				}
				parentEl.remove();
			});
		});

		$('#apply').on('click', Events.refresh);
	};

	Events.refresh = function (event) {
		event.preventDefault();

		var formEl = $('#filters');
		ajaxify.go('admin/advanced/events?' + formEl.serialize());
	};

	return Events;
});
