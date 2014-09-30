"use strict";
/*global define, ajaxify, app, socket, RELATIVE_PATH*/

define('forum/admin/general/dashboard', ['semver'], function(semver) {
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
		}, 5000);

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

		var html = '<div class="text-center pull-left">' + 
						'<div>'+ data.onlineRegisteredCount +'</div>' + 
						'<div>Users</div>' +
					'</div>' +
					'<div class="text-center pull-left">' + 
						'<div>'+ data.onlineGuestCount +'</div>' + 
						'<div>Guests</div>' +
					'</div>' +
					'<div class="text-center pull-left">' + 
						'<div>'+ (data.onlineRegisteredCount + data.onlineGuestCount) +'</div>' + 
						'<div>Total</div>' +
					'</div>' +
					'<div class="text-center pull-left">' + 
						'<div>'+ data.socketCount +'</div>' + 
						'<div>Connections</div>' +
					'</div>';

		var idle = data.socketCount - (data.users.home + data.users.topics + data.users.category);

		updateRegisteredGraph(data.onlineRegisteredCount, data.onlineGuestCount);
		updatePresenceGraph(data.users.home, data.users.topics, data.users.category, idle);
		updateTopicsGraph(data.topics);

		$('#active-users').html(html);
	};

	var graphs = {
		traffic: null,
		registered: null,
		presence: null,
		topics: null
	};

	var topicColors = ["#bf616a","#5B90BF","#d08770","#ebcb8b","#a3be8c","#96b5b4","#8fa1b3","#b48ead","#ab7967","#46BFBD"],
		usedTopicColors = [];

	// from chartjs.org
	function lighten(col, amt) {
		var usePound = false;

		if (col[0] == "#") {
			col = col.slice(1);
			usePound = true;
		}

		var num = parseInt(col,16);

		var r = (num >> 16) + amt;

		if (r > 255) r = 255;
		else if  (r < 0) r = 0;

		var b = ((num >> 8) & 0x00FF) + amt;

		if (b > 255) b = 255;
		else if  (b < 0) b = 0;

		var g = (num & 0x0000FF) + amt;

		if (g > 255) g = 255;
		else if (g < 0) g = 0;

		return (usePound?"#":"") + (g | (b << 8) | (r << 16)).toString(16);
	}

	function getHoursArray() {
		var currentHour = new Date().getHours(),
			labels = [];

		for (var i = currentHour, ii = currentHour - 12; i > ii; i--) {
			var hour = i < 0 ? 24 + i : i;
			labels.push(hour + ':00 ');
		}

		return labels.reverse();
	}

	function setupGraphs() {
		var trafficCanvas = document.getElementById('analytics-traffic'),
			registeredCanvas = document.getElementById('analytics-registered'),
			presenceCanvas = document.getElementById('analytics-presence'),
			topicsCanvas = document.getElementById('analytics-topics'),
			trafficCtx = trafficCanvas.getContext('2d'),
			registeredCtx = registeredCanvas.getContext('2d'),
			presenceCtx = presenceCanvas.getContext('2d'),
			topicsCtx = topicsCanvas.getContext('2d'),
			trafficLabels = getHoursArray();

		var data = {
				labels: trafficLabels,
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

		trafficCanvas.width = $(trafficCanvas).parent().width(); // is this necessary
		graphs.traffic = new Chart(trafficCtx).Line(data, {
			responsive: true
		});

		graphs.registered = new Chart(registeredCtx).Doughnut([{
		        value: 1,
		        color:"#F7464A",
		        highlight: "#FF5A5E",
		        label: "Registered Users"
		    },
		    {
		        value: 1,
		        color: "#46BFBD",
		        highlight: "#5AD3D1",
		        label: "Anonymous Users"
		    }], {
		    	responsive: true
		    });

		graphs.presence = new Chart(presenceCtx).Doughnut([{
		        value: 1,
		        color:"#F7464A",
		        highlight: "#FF5A5E",
		        label: "On homepage"
		    },
		    {
		        value: 1,
		        color: "#46BFBD",
		        highlight: "#5AD3D1",
		        label: "Reading posts"
		    },
		    {
		        value: 1,
		        color: "#FDB45C",
		        highlight: "#FFC870",
		        label: "Browsing topics"
		    },
		    {
		        value: 1,
		        color: "#949FB1",
		        highlight: "#A8B3C5",
		        label: "Idle"
		    }], {
		    	responsive: true
		    });

		graphs.topics = new Chart(topicsCtx).Doughnut([], {responsive: true});
		topicsCanvas.onclick = function(evt){
			var obj = graphs.topics.getSegmentsAtEvent(evt);
			window.open(RELATIVE_PATH + '/topic/' + obj[0].tid);
		};

		setInterval(updateTrafficGraph, 15000);
		updateTrafficGraph();

		$(window).on('resize', adjustPieCharts);
		adjustPieCharts();
	}

	function adjustPieCharts() {
		$('.pie-chart.legend-up').each(function() {
			var $this = $(this);

			if ($this.width() < 320) {
				$this.addClass('compact');
			} else {
				$this.removeClass('compact');
			}
		});
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

	function updateRegisteredGraph(registered, anonymous) {
		graphs.registered.segments[0].value = registered;
		graphs.registered.segments[1].value = anonymous;
		graphs.registered.update();
	}

	function updatePresenceGraph(homepage, posts, topics, idle) {
		graphs.presence.segments[0].value = homepage;
		graphs.presence.segments[1].value = posts;
		graphs.presence.segments[2].value = topics;
		graphs.presence.segments[3].value = idle;
		graphs.presence.update();
	}

	function updateTopicsGraph(topics) {
		if (!Object.keys(topics).length) {
			topics = {"0": {
				title: "No users browsing",
				value: 1
			}};
		}

		var tids = Object.keys(topics),
			segments = graphs.topics.segments;

		function reassignExistingTopics() {
			for (var i = 0, ii = segments.length; i < ii; i++ ) {
				if (!segments[i]) {
					continue;
				}

				var tid = segments[i].tid;

				if ($.inArray(tid, tids) === -1) {
					usedTopicColors.splice($.inArray(segments[i].color, usedTopicColors), 1);
					graphs.topics.removeData(i);
				} else {
					graphs.topics.segments[i].value = topics[tid].value;
					delete topics[tid];
				}
			}
		}

		function assignNewTopics() {
			while (segments.length < 10 && tids.length > 0) {
				var tid = tids.pop(),
					data = topics[tid],
					color = null;

				if (!data) {
					continue;
				}

				if (tid === '0') {
					color = '#4D5360';
				} else {
					do {
						for (var i = 0, ii = topicColors.length; i < ii; i++) {
							var chosenColor = topicColors[i];

							if ($.inArray(chosenColor, usedTopicColors) === -1) {
								color = chosenColor;
								usedTopicColors.push(color);
								break;
							}
						}
					} while (color === null && usedTopicColors.length < topicColors.length);
				}

				if (color) {
					graphs.topics.addData({
						value: data.value,
						color: color,
						highlight: lighten(color, 10),
						label: data.title
					});

					segments[segments.length - 1].tid = tid;
				}
			}
		}

		function buildTopicsLegend() {
			var legend = $('#topics-legend').html('');

			for (var i = 0, ii = segments.length; i < ii; i++) {
				var topic = segments[i],
					label = topic.tid === '0' ? topic.label : '<a title="' + topic.label + '"href="' + RELATIVE_PATH + '/topic/' + topic.tid + '" target="_blank"> ' + topic.label + '</a>';

				legend.append(
					'<li>' +
						'<div style="background-color: ' + topic.highlightColor + '; border-color: ' + topic.strokeColor + '"></div>' +
						'<span>' + label + '</span>' +
					'</li>');
			}
		}

		reassignExistingTopics();
		assignNewTopics();
		buildTopicsLegend();

		graphs.topics.update();
	}

	function buildTopicsLegend() {

	}

	return Admin;
});
