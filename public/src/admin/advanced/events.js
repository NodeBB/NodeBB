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

		$('#filter').on('change', function () {
			var filter = $(this).val();
			ajaxify.go('admin/advanced/events' + (filter ? '?filter=' + filter : ''));
		});
	};

	return Events;
});
