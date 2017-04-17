'use strict';


define('admin/modules/instance', function () {
	var instance = {};

	instance.reload = function (callback) {
		app.alert({
			alert_id: 'instance_reload',
			type: 'info',
			title: 'Reloading... <i class="fa fa-spin fa-refresh"></i>',
			message: 'NodeBB is reloading.',
			timeout: 5000,
		});

		$(window).one('action:reconnected', function () {
			app.alert({
				alert_id: 'instance_reload',
				type: 'success',
				title: '<i class="fa fa-check"></i> Success',
				message: 'NodeBB has reloaded successfully.',
				timeout: 5000,
			});

			if (typeof callback === 'function') {
				callback();
			}
		});

		socket.emit('admin.reload');
	};

	instance.restart = function (callback) {
		app.alert({
			alert_id: 'instance_restart',
			type: 'info',
			title: 'Rebuilding... <i class="fa fa-spin fa-refresh"></i>',
			message: 'NodeBB is rebuilding front-end assets (css, javascript, etc).',
			timeout: 10000,
		});

		$(window).one('action:reconnected', function () {
			app.alert({
				alert_id: 'instance_restart',
				type: 'success',
				title: '<i class="fa fa-check"></i> Success',
				message: 'NodeBB has successfully restarted.',
				timeout: 10000,
			});

			if (typeof callback === 'function') {
				callback();
			}
		});

		socket.emit('admin.restart', function () {
			app.alert({
				alert_id: 'instance_restart',
				type: 'info',
				title: 'Build Complete!... <i class="fa fa-spin fa-refresh"></i>',
				message: 'NodeBB is reloading.',
				timeout: 10000,
			});
		});
	};

	return instance;
});
