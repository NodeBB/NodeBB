'use strict';

define('admin/advanced/cache', ['alerts'], function (alerts) {
	const Cache = {};
	Cache.init = function () {
		require(['admin/settings'], function (Settings) {
			Settings.prepare();
		});

		$('.clear').on('click', function () {
			const name = $(this).attr('data-name');
			socket.emit('admin.cache.clear', { name: name }, function (err) {
				if (err) {
					return alerts.error(err);
				}
				ajaxify.refresh();
			});
		});

		$('.checkbox').on('change', function () {
			const input = $(this).find('input');
			const flag = input.is(':checked');
			const name = $(this).attr('data-name');
			socket.emit('admin.cache.toggle', { name: name, enabled: flag }, function (err) {
				if (err) {
					return alerts.error(err);
				}
			});
		});
	};
	return Cache;
});
