'use strict';


define('admin/settings/cookies', [
	'admin/modules/colorpicker',
], function (colorpicker) {
	var Module = {};

	Module.init = function () {
		colorpicker.enable($('[data-colorpicker="1"]'));

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
