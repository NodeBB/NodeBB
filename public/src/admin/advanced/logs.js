'use strict';


define('admin/advanced/logs', function () {
	const	Logs = {};

	Logs.init = function () {
		const logsEl = $('.logs pre');
		logsEl.scrollTop(logsEl.prop('scrollHeight'));
		// Affix menu
		$('.affix').affix();

		$('.logs').find('button[data-action]').on('click', function () {
			const btnEl = $(this);
			const action = btnEl.attr('data-action');

			switch (action) {
				case 'reload':
					socket.emit('admin.logs.get', function (err, logs) {
						if (!err) {
							logsEl.text(logs);
							logsEl.scrollTop(logsEl.prop('scrollHeight'));
						} else {
							app.alertError(err.message);
						}
					});
					break;

				case 'clear':
					socket.emit('admin.logs.clear', function (err) {
						if (!err) {
							app.alertSuccess('[[admin/advanced/logs:clear-success]]');
							btnEl.prev().click();
						}
					});
					break;
			}
		});
	};

	return Logs;
});
