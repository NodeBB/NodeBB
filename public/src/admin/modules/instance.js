"use strict";

/*globals define, app, socket*/

define('admin/modules/instance', function() {
	var instance = {};

	instance.reload = function(callback) {
		app.alert({
			alert_id: 'instance_reload',
			type: 'info',
			title: 'Reloading... <i class="fa fa-spin fa-refresh"></i>',
			message: 'NodeBB is reloading.',
			timeout: 5000
		});

		socket.emit('admin.reload', function(err) {
			if (!err) {
				app.alert({
					alert_id: 'instance_reload',
					type: 'success',
					title: '<i class="fa fa-check"></i> Success',
					message: 'NodeBB has successfully reloaded.',
					timeout: 5000
				});
			} else {
				app.alert({
					alert_id: 'instance_reload',
					type: 'danger',
					title: '[[global:alert.error]]',
					message: '[[error:reload-failed, ' + err.message + ']]'
				});
			}

			if (typeof callback === 'function') {
				callback();
			}
		});
	};

	instance.restart = function(callback) {
		app.alert({
			alert_id: 'instance_restart',
			type: 'info',
			title: 'Restarting... <i class="fa fa-spin fa-refresh"></i>',
			message: 'NodeBB is restarting.',
			timeout: 5000
		});

		$(window).one('action:reconnected', function() {
			app.alert({
				alert_id: 'instance_restart',
				type: 'success',
				title: '<i class="fa fa-check"></i> Success',
				message: 'NodeBB has successfully restarted.',
				timeout: 5000
			});

			if (typeof callback === 'function') {
				callback();
			}
		});

		socket.emit('admin.restart');
	};
	
	return instance;
});
