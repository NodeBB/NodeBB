"use strict";
/* global define, socket */

define('admin/settings/general', ['admin/settings'], function(Settings) {
	var Module = {}

	Module.init = function() {
		$('button[data-action="removeLogo"]').on('click', function() {
			socket.emit('admin.settings.removeLogo', function() {
				app.alertSuccess('Logo removed');
			});
		});
	};

	return Module;
});
