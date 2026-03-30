'use strict';


define('admin/advanced/events', ['bootbox', 'alerts', 'autocomplete'], function (bootbox, alerts, autocomplete) {
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
			return false;
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

		$('#user-group-select').on('change', function () {
			const val = $(this).val();
			$('#username').toggleClass('hidden', val !== 'username');
			if (val !== 'username') {
				$('#username').val('');
			}
			$('#group').toggleClass('hidden', val !== 'group');
			if (val !== 'group') {
				$('#group').val('');
			}
		});

		autocomplete.user($('#username'));
		autocomplete.group($('#group'));

		$('#apply').on('click', Events.refresh);
	};

	Events.refresh = function (event) {
		event.preventDefault();

		const $formEl = $('#filters');
		ajaxify.go('admin/advanced/events?' + $formEl.serialize());
	};

	return Events;
});
