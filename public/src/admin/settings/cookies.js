'use strict';

define('admin/settings/cookies', function () {
	var Module = {};

	Module.init = function () {
		$('#delete-all-sessions').on('click', function () {
			socket.emit('admin.deleteAllSessions', function (err) {
				if (err) {
					return app.alertError(err.message);
				}
				window.location.href = config.relative_path + '/login';
			});
			return false;
		});
	};

	return Module;
});
