'use strict';

define('admin/advanced/cache', function () {
	var Cache = {};
	Cache.init = function () {
		require(['admin/settings'], function (Settings) {
			Settings.prepare();
		});

		$('#clear').on('click', function () {
			socket.emit('admin.cache.clear', function (err) {
				if (err) {
					return app.alertError(err.message);
				}
				ajaxify.refresh();
			});
		});
	};
	return Cache;
});
