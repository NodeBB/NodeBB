"use strict";
/*global define, ajaxify, app, socket, RELATIVE_PATH*/

define('forum/admin/index', function() {
	var	Admin = {};

	Admin.init = function() {

		app.enterRoom('admin');
		socket.emit('meta.rooms.getAll', Admin.updateRoomUsage);

		socket.removeListener('event:meta.rooms.update', Admin.updateRoomUsage);
		socket.on('event:meta.rooms.update', Admin.updateRoomUsage);

		$('#logout-link').on('click', function() {
			$.post(RELATIVE_PATH + '/logout', {
				_csrf: $('#csrf_token').val()
			}, function() {
				window.location.href = RELATIVE_PATH + '/';
			});
		});

		$.get('https://api.github.com/repos/NodeBB/NodeBB/tags', function(releases) {
			var	version = $('#version').html(),
				latestVersion = releases[0].name.slice(1),
				checkEl = $('.version-check');
			checkEl.html($('.version-check').html().replace('<i class="fa fa-spinner fa-spin"></i>', 'v' + latestVersion));

			// Alter box colour accordingly
			if (latestVersion === version) {
				checkEl.removeClass('alert-info').addClass('alert-success');
				checkEl.append('<p>You are <strong>up-to-date</strong> <i class="fa fa-check"></i></p>');
			} else if (latestVersion > version) {
				checkEl.removeClass('alert-info').addClass('alert-danger');
				checkEl.append('<p>A new version (v' + latestVersion + ') has been released. Consider upgrading your NodeBB.</p>');
			}
		});

		$('.restart').on('click', function() {
			bootbox.confirm('Are you sure you wish to restart NodeBB?', function(confirm) {
				if (confirm) {
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
					});

					socket.emit('admin.restart');
				}
			});
		});

		$('.reload').on('click', function() {
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
						message: err.message
					});
				}
			});
		});
	};

	Admin.updateRoomUsage = function(err, data) {

		function getUserCountIn(room) {
			var count = 0;
			for(var user in data[room]) {
				if (data[room].hasOwnProperty(user)) {
					++count;
				}
			}
			return count;
		}

		var active_users = $('#active_users').html(''),
			total = 0;

		if(!active_users.length) {
			return;
		}


		var sortedData = [];

		for (var room in data) {
			if (room !== '') {
				sortedData.push({room: room, count: data[room].length});
				total += data[room].length;
			}
		}

		sortedData.sort(function(a, b) {
			return parseInt(b.count, 10) - parseInt(a.count, 10);
		});

		var usersHtml = '';
		for(var i=0; i<sortedData.length; ++i) {
			usersHtml += "<div class='alert alert-success'><strong>" + sortedData[i].room + "</strong> " +
				sortedData[i].count + " active user" + (sortedData[i].count > 1 ? "s" : "") + "</div>";
		}

		active_users.html(usersHtml);
		$('#connections').html(total);
	};

	return Admin;
});
