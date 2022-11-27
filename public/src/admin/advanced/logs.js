'use strict';


define('admin/advanced/logs', ['alerts'], function (alerts) {
	const Logs = {};

	Logs.init = function () {
		const logsEl = $('.logs pre');
		logsEl.scrollTop(logsEl.prop('scrollHeight'));

		$('.logs').find('button[data-action]').on('click', function () {
			const btnEl = $(this);
			const action = btnEl.attr('data-action');

			switch (action) {
				case 'reload':
					loadLogs();
					break;

				case 'clear':
					socket.emit('admin.logs.clear', function (err) {
						if (!err) {
							alerts.success('[[admin/advanced/logs:clear-success]]');
							loadLogs();
						} else {
							alerts.error(err);
						}
					});
					break;
			}
		});
	};

	function loadLogs() {
		const logsEl = $('.logs pre');
		socket.emit('admin.logs.get', function (err, logs) {
			if (!err) {
				logsEl.text(logs);
				logsEl.scrollTop(logsEl.prop('scrollHeight'));
			} else {
				alerts.error(err);
			}
		});
	}

	return Logs;
});
