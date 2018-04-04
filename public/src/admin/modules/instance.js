'use strict';

define('admin/modules/instance', [
	// need to preload the compiled alert template
	// otherwise it can be unloaded when rebuild & restart is run
	// the client can't fetch the template file, resulting in an error
	config.relative_path + '/assets/templates/alert.js',
], function () {
	var instance = {};

	instance.rebuildAndRestart = function (callback) {
		app.alert({
			alert_id: 'instance_rebuild_and_restart',
			type: 'info',
			title: 'Rebuilding... <i class="fa fa-spin fa-refresh"></i>',
			message: 'NodeBB is rebuilding front-end assets (css, javascript, etc).',
		});

		$(window).one('action:reconnected', function () {
			app.alert({
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
			app.alert({
				alert_id: 'instance_rebuild_and_restart',
				type: 'info',
				title: 'Build Complete!... <i class="fa fa-spin fa-refresh"></i>',
				message: 'NodeBB is restarting.',
			});
		});
	};

	instance.restart = function (callback) {
		app.alert({
			alert_id: 'instance_restart',
			type: 'info',
			title: 'Restarting... <i class="fa fa-spin fa-refresh"></i>',
			message: 'NodeBB is restarting.',
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
