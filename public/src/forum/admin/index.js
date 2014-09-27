"use strict";
/*global define, ajaxify, app, socket, RELATIVE_PATH*/

define('forum/admin/index', ['semver'], function(semver) {
	var	Admin = {};
	var updateIntervalId = 0;
	Admin.init = function() {
		app.enterRoom('admin');
		socket.emit('meta.rooms.getAll', Admin.updateRoomUsage);

		if (updateIntervalId) {
			clearInterval(updateIntervalId);
		}
		updateIntervalId = setInterval(function() {
			socket.emit('meta.rooms.getAll', Admin.updateRoomUsage);
		}, 3000);

		$('#logout-link').on('click', function() {
			$.post(RELATIVE_PATH + '/logout', function() {
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
						message: '[[error:reload-failed, ' + err.message + ']]'
					});
				}
			});
		});

		setupGraphs();
	};

	Admin.updateRoomUsage = function(err, data) {
		if (err) {
			return app.alertError(err.message);
		}

		var html = '<strong>Online Users [ ' + data.onlineRegisteredCount + ' ]</strong><br/>' +
					'<strong>Online Guests [ ' + data.onlineGuestCount + ' ]</strong><br/>'	 +
					'<strong>Online Total [ ' + (data.onlineRegisteredCount + data.onlineGuestCount) + ' ]</strong><br/>' +
					'<strong>Socket Connections [ ' + data.socketCount + ' ]</strong>';

		$('#active_users').html(html);
	};

	var graphs = {
		traffic: null
	};

	function getHoursArray() {
		var currentHour = new Date().getHours(),
			labels = [];

		for (var i = currentHour, ii = currentHour - 12; i > ii; i--) {
			var hour = i < 0 ? 24 + i : i;
			labels.push(hour + ':00 ' + (hour >= 12 ? 'PM' : 'AM'));
		}

		return labels.reverse();
	}

	function setupGraphs() {
		var canvas = document.getElementById('analytics-traffic'),
			ctx = canvas.getContext('2d'),
			labels = getHoursArray();

		var data = {
				labels: labels,
				datasets: [
					{
						label: "Page Views",
						fillColor: "rgba(220,220,220,0.2)",
						strokeColor: "rgba(220,220,220,1)",
						pointColor: "rgba(220,220,220,1)",
						pointStrokeColor: "#fff",
						pointHighlightFill: "#fff",
						pointHighlightStroke: "rgba(220,220,220,1)",
						data: [0,0,0,0,0,0,0,0,0,0,0,0]
					},
					{
						label: "Unique Visitors",
						fillColor: "rgba(151,187,205,0.2)",
						strokeColor: "rgba(151,187,205,1)",
						pointColor: "rgba(151,187,205,1)",
						pointStrokeColor: "#fff",
						pointHighlightFill: "#fff",
						pointHighlightStroke: "rgba(151,187,205,1)",
						data: [0,0,0,0,0,0,0,0,0,0,0,0]
					}
				]
			};

		canvas.width = $(canvas).parent().width();
		graphs.traffic = new Chart(ctx).Line(data);

		setInterval(updateTrafficGraph, 15000);
		updateTrafficGraph();
	}

	function updateTrafficGraph() {
		socket.emit('admin.analytics.get', {graph: "traffic"}, function (err, data) {
			for (var i = 0, ii = data.pageviews.length; i < ii;  i++) {
				graphs.traffic.datasets[0].points[i].value = data.pageviews[i];
				graphs.traffic.datasets[1].points[i].value = data.uniqueVisitors[i];
			}

			var currentHour = new Date().getHours();

			graphs.traffic.scale.xLabels = getHoursArray();
			graphs.traffic.update();
		});
	}

	return Admin;
});
