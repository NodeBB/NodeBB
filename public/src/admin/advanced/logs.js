"use strict";
/* global define, socket, app */

define('admin/advanced/logs', function() {
	var	Logs = {};

	Logs.init = function() {
		var logsEl = $('.logs pre');
		logsEl.scrollTop(logsEl.prop('scrollHeight'));
		// Affix menu
		$('.affix').affix();

		$('.logs').find('button[data-action]').on('click', function(e) {
			var btnEl = $(this),
				action = btnEl.attr('data-action');

			switch(action) {
				case 'reload':
					socket.emit('admin.logs.get', function(err, logs) {
						if (!err) {
							logsEl.text(logs);
							logsEl.scrollTop(logsEl.prop('scrollHeight'));
						} else {
							app.alertError(err.message);
						}
					});
					break;

				case 'clear':
					socket.emit('admin.logs.clear', function(err) {
						if (!err) {
							app.alertSuccess('Logs Cleared!');
							btnEl.prev().click();
						}
					});
					break;
			}
		});
	};

	return Logs;
});
