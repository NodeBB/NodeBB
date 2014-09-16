"use strict";
/*global define, ajaxify, app, socket, RELATIVE_PATH*/

define('forum/admin/index', ['semver'], function(semver) {
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
			// Re-sort the releases, as they do not follow Semver (wrt pre-releases)
			releases = releases.sort(function(a, b) {
				a = a.name.replace(/^v/, '');
				b = b.name.replace(/^v/, '');
				return semver.lt(a, b) ? 1 : -1;
			});

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
			app.alert({
				timeout: 5000,
				title: 'Restarting...',
				message: 'NodeBB is restarting.',
				type: 'info'
			});

			$(window).one('action:reconnected', function() {
				app.alertSuccess('NodeBB has successfully restarted.');
			});

			socket.emit('admin.restart');
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
