'use strict';

define('admin/modules/instance', [
	'alerts',
], function (alerts) {
	const instance = {};

	instance.rebuildAndRestart = function (callback) {
		alerts.alert({
			alert_id: 'instance_rebuild_and_restart',
			type: 'info',
			title: 'Rebuilding... <i class="fa fa-spin fa-refresh"></i>',
			message: 'NodeBB is rebuilding front-end assets (css, javascript, etc).',
		});

		$(window).one('action:reconnected', function () {
			alerts.alert({
				alert_id: 'instance_rebuild_and_restart',
				type: 'success',
				title: '<i class="fa fa-check"></i> Success',
				message: 'NodeBB has rebuilt and restarted successfully.',
				timeout: 5000,
			});

			if (typeof callback === 'function') {
				callback();
			}
		});

		socket.emit('admin.reload', function () {
			alerts.alert({
				alert_id: 'instance_rebuild_and_restart',
				type: 'info',
				title: 'Build Complete!... <i class="fa fa-spin fa-refresh"></i>',
				message: 'NodeBB is restarting.',
			});
		});
	};

	instance.restart = function (callback) {
		alerts.alert({
			alert_id: 'instance_restart',
			type: 'info',
			title: 'Restarting... <i class="fa fa-spin fa-refresh"></i>',
			message: 'NodeBB is restarting.',
		});

		$(window).one('action:reconnected', function () {
			alerts.alert({
				alert_id: 'instance_restart',
				type: 'success',
				title: '<i class="fa fa-check"></i> Success',
				message: 'NodeBB has restarted successfully.',
				timeout: 5000,
			});

			if (typeof callback === 'function') {
				callback();
			}
		});

		socket.emit('admin.restart');
	};

	return instance;
});
