'use strict';

define('admin/settings/cookies', ['alerts'], function (alerts) {
	const Module = {};

	Module.init = function () {
		$('#delete-all-sessions').on('click', function () {
			socket.emit('admin.deleteAllSessions', function (err) {
				if (err) {
					return alerts.error(err);
				}
				window.location.href = config.relative_path + '/login';
			});
			return false;
		});
	};

	return Module;
});
