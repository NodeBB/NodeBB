'use strict';

define('admin/modules/instance', [
	'alerts',
], function (alerts) {
	const instance = {};

	instance.rebuildAndRestart = function (callback) {
		alerts.alert({
			alert_id: 'instance_rebuild_and_restart',
			type: 'info',
			title: '[[admin/admin:rebuilding.title]]',
			message: '[[admin/admin:rebuilding.message]]',
		});

		$(window).one('action:reconnected', function () {
			alerts.alert({
				alert_id: 'instance_rebuild_and_restart',
				type: 'success',
				title: '[[admin/admin:rebuildrestart.success.title]]',
				message: '[[admin/admin:rebuilding.success.message]]',
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
				title: '[[admin/admin:build.complete]]',
				message: '[[admin/admin:restarting.message]]',
			});
		});
	};

	instance.restart = function (callback) {
		alerts.alert({
			alert_id: 'instance_restart',
			type: 'info',
			title: '[[admin/admin:restarting.title]]',
			message: '[[admin/admin:restarting.message]]',
		});

		$(window).one('action:reconnected', function () {
			alerts.alert({
				alert_id: 'instance_restart',
				type: 'success',
				title: '[[admin/admin:rebuildrestart.success.title]]',
				message: '[[admin/admin:restarting.success.message]]',
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
