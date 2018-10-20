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

		$('#filter').on('change', function () {
			var filter = $(this).val();
			ajaxify.go('admin/advanced/events' + (filter ? '?filter=' + filter : ''));
		});
	};

	return Events;
});
