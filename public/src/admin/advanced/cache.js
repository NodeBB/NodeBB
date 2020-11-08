'use strict';

define('admin/advanced/cache', function () {
	var Cache = {};
	Cache.init = function () {
		require(['admin/settings'], function (Settings) {
			Settings.prepare();
		});

		$('.clear').on('click', function () {
			var name = $(this).attr('data-name');
			socket.emit('admin.cache.clear', { name: name }, function (err) {
				if (err) {
					return app.alertError(err.message);
				}
				ajaxify.refresh();
			});
		});

		$('.checkbox').on('change', function () {
			var input = $(this).find('input');
			var flag = input.is(':checked');
			var name = $(this).attr('data-name');
			socket.emit('admin.cache.toggle', { name: name, enabled: flag }, function (err) {
				if (err) {
					return app.alertError(err.message);
				}
			});
		});
	};
	return Cache;
});
