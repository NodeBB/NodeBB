'use strict';


define('admin/advanced/events', ['bootbox', 'alerts'], function (bootbox, alerts) {
	const Events = {};

	Events.init = function () {
		$('[data-action="clear"]').on('click', function () {
			bootbox.confirm('[[admin/advanced/events:confirm-delete-all-events]]', (confirm) => {
				if (confirm) {
					socket.emit('admin.deleteAllEvents', function (err) {
						if (err) {
							return alerts.error(err);
						}
						$('.events-list').empty();
					});
				}
			});
		});

		$('.delete-event').on('click', function () {
			const $parentEl = $(this).parents('[data-eid]');
			const eid = $parentEl.attr('data-eid');
			socket.emit('admin.deleteEvents', [eid], function (err) {
				if (err) {
					return alerts.error(err);
				}
				$parentEl.remove();
			});
		});

		$('#apply').on('click', Events.refresh);
	};

	Events.refresh = function (event) {
		event.preventDefault();

		const $formEl = $('#filters');
		ajaxify.go('admin/advanced/events?' + $formEl.serialize());
	};

	return Events;
});
