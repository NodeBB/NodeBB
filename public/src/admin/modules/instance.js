'use strict';


define('admin/modules/instance', function () {
	var instance = {};

	instance.reload = function (callback) {
		app.alert({
			alert_id: 'instance_reload',
			type: 'info',
			title: 'Rebuilding... <i class="fa fa-spin fa-refresh"></i>',
			message: 'NodeBB is rebuilding front-end assets (css, javascript, etc).',
			timeout: 10000,
		});

		$(window).one('action:reconnected', function () {
			app.alert({
				alert_id: 'instance_reload',
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
			app.alert({
				alert_id: 'instance_rebuilt',
				type: 'info',
				title: 'Build Complete!... <i class="fa fa-spin fa-refresh"></i>',
				message: 'NodeBB is restarting.',
				timeout: 5000,
			});
		});
	};

	instance.restart = function (callback) {
		app.alert({
			alert_id: 'instance_restart',
			type: 'info',
			title: 'Restarting... <i class="fa fa-spin fa-refresh"></i>',
			message: 'NodeBB is restarting.',
			timeout: 5000,
		});

		$(window).one('action:reconnected', function () {
			app.alert({
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
