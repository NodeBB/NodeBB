"use strict";
/*global define, ajaxify, app, socket, utils, bootbox, RELATIVE_PATH*/

define('admin/general/dashboard', ['semver', 'Chart'], function(semver, Chart) {
	var	Admin = {},
		intervals = {
			rooms: false,
			graphs: false
		},
		isMobile = false,
		isPrerelease = /^v?\d+\.\d+\.\d+-.+$/,
		graphData = {
			rooms: {},
			traffic: {}
		},
		currentGraph = {
			units: 'hours',
			until: undefined
		};

	var DEFAULTS = {
		roomInterval: 10000,
		graphInterval: 15000,
		realtimeInterval: 1500
	};
	
	$(window).on('action:ajaxify.start', function(ev, data) {
		clearInterval(intervals.rooms);
		clearInterval(intervals.graphs);

		intervals.rooms = null;
		intervals.graphs = null;
		graphData.rooms = null;
		graphData.traffic = null;
		usedTopicColors.length = 0;
	});

	Admin.init = function() {
		app.enterRoom('admin');
		socket.emit('admin.rooms.getAll', Admin.updateRoomUsage);

		isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);

		$.get('https://api.github.com/repos/NodeBB/NodeBB/tags', function(releases) {
			// Re-sort the releases, as they do not follow Semver (wrt pre-releases)
			releases = releases.sort(function(a, b) {
				a = a.name.replace(/^v/, '');
				b = b.name.replace(/^v/, '');
				return semver.lt(a, b) ? 1 : -1;
			}).filter(function(version) {
				return !isPrerelease.test(version.name);	// filter out automated prerelease versions
			});

			var	version = $('#version').html(),
				latestVersion = releases[0].name.slice(1),
				checkEl = $('.version-check');

			// Alter box colour accordingly
			if (semver.eq(latestVersion, version)) {
				checkEl.removeClass('alert-info').addClass('alert-success');
				checkEl.append('<p>You are <strong>up-to-date</strong> <i class="fa fa-check"></i></p>');
			} else if (semver.gt(latestVersion, version)) {
				checkEl.removeClass('alert-info').addClass('alert-warning');
				if (!isPrerelease.test(version)) {
					checkEl.append('<p>A new version (v' + latestVersion + ') has been released. Consider <a href="https://docs.nodebb.org/en/latest/upgrading/index.html">upgrading your NodeBB</a>.</p>');
				} else {
					checkEl.append('<p>This is an outdated pre-release version of NodeBB. A new version (v' + latestVersion + ') has been released. Consider <a href="https://docs.nodebb.org/en/latest/upgrading/index.html">upgrading your NodeBB</a>.</p>');
				}
			} else if (isPrerelease.test(version)) {
				checkEl.removeClass('alert-info').addClass('alert-info');
				checkEl.append('<p>This is a <strong>pre-release</strong> version of NodeBB. Unintended bugs may occur. <i class="fa fa-exclamation-triangle"></i>.</p>');
			}
		});

		$('[data-toggle="tooltip"]').tooltip();

		setupRealtimeButton();
		setupGraphs();
		initiateDashboard();
	};

	Admin.updateRoomUsage = function(err, data) {
		if (err) {
			return app.alertError(err.message);
		}

		if (JSON.stringify(graphData.rooms) === JSON.stringify(data)) {
			return;
		}

		graphData.rooms = data;

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

		updateRegisteredGraph(data.onlineRegisteredCount, data.onlineGuestCount);
		updatePresenceGraph(data.users);
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

	function setupGraphs() {
		var trafficCanvas = document.getElementById('analytics-traffic'),
			registeredCanvas = document.getElementById('analytics-registered'),
			presenceCanvas = document.getElementById('analytics-presence'),
			topicsCanvas = document.getElementById('analytics-topics'),
			trafficCtx = trafficCanvas.getContext('2d'),
			registeredCtx = registeredCanvas.getContext('2d'),
			presenceCtx = presenceCanvas.getContext('2d'),
			topicsCtx = topicsCanvas.getContext('2d'),
			trafficLabels = utils.getHoursArray();

		if (isMobile) {
			Chart.defaults.global.showTooltips = false;
			Chart.defaults.global.animation = false;
		}

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
						data: [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0]
					},
					{
						label: "Unique Visitors",
						fillColor: "rgba(151,187,205,0.2)",
						strokeColor: "rgba(151,187,205,1)",
						pointColor: "rgba(151,187,205,1)",
						pointStrokeColor: "#fff",
						pointHighlightFill: "#fff",
						pointHighlightStroke: "rgba(151,187,205,1)",
						data: [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0]
					}
				]
			};

		trafficCanvas.width = $(trafficCanvas).parent().width();
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
				label: "On categories list"
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
				label: "Recent"
			},
			{
				value: 1,
				color: "#9FB194",
				highlight: "#A8B3C5",
				label: "Unread"
			}
			], {
				responsive: true
			});

		graphs.topics = new Chart(topicsCtx).Doughnut([], {responsive: true});
		topicsCanvas.onclick = function(evt){
			var obj = graphs.topics.getSegmentsAtEvent(evt);
			if (obj && obj[0]) {
				window.open(RELATIVE_PATH + '/topic/' + obj[0].tid);
			}
		};

		updateTrafficGraph();

		$(window).on('resize', adjustPieCharts);
		adjustPieCharts();

		$('[data-action="updateGraph"]').on('click', function() {
			var until = undefined;
			switch($(this).attr('data-until')) {
				case 'last-month':
					var lastMonth = new Date();
					lastMonth.setDate(lastMonth.getDate()-30);
					until = lastMonth.getTime();
			}
			updateTrafficGraph($(this).attr('data-units'), until);
		});
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

	function updateTrafficGraph(units, until) {
		if (!app.isFocused) {
			return;
		}

		socket.emit('admin.analytics.get', {
			graph: 'traffic',
			units: units || 'hours',
			until: until
		}, function (err, data) {
			if (JSON.stringify(graphData.traffic) === JSON.stringify(data)) {
				return;
			}

			graphData.traffic = data;

			// If new data set contains fewer points than currently shown, truncate
			while(graphs.traffic.datasets[0].points.length > data.pageviews.length) {
				graphs.traffic.removeData();
			}

			if (units === 'days') {
				graphs.traffic.scale.xLabels = utils.getDaysArray(until);
			} else {
				graphs.traffic.scale.xLabels = utils.getHoursArray();

				$('#pageViewsThisMonth').html(data.monthlyPageViews.thisMonth);
				$('#pageViewsLastMonth').html(data.monthlyPageViews.lastMonth);
				$('#pageViewsPastDay').html(data.pastDay);
				utils.addCommasToNumbers($('#pageViewsThisMonth'));
				utils.addCommasToNumbers($('#pageViewsLastMonth'));
				utils.addCommasToNumbers($('#pageViewsPastDay'));
			}

			for (var i = 0, ii = data.pageviews.length; i < ii;  i++) {
				if (graphs.traffic.datasets[0].points[i]) {
					graphs.traffic.datasets[0].points[i].value = data.pageviews[i];
					graphs.traffic.datasets[0].points[i].label = graphs.traffic.scale.xLabels[i];
					graphs.traffic.datasets[1].points[i].value = data.uniqueVisitors[i];
					graphs.traffic.datasets[1].points[i].label = graphs.traffic.scale.xLabels[i];
				} else {
					// No points to replace? Add data.
					graphs.traffic.addData([data.pageviews[i], data.uniqueVisitors[i]], graphs.traffic.scale.xLabels[i]);
				}
			}

			graphs.traffic.update();
			currentGraph.units = units;
			currentGraph.until = until;
		});
	}

	function updateRegisteredGraph(registered, anonymous) {
		graphs.registered.segments[0].value = registered;
		graphs.registered.segments[1].value = anonymous;
		graphs.registered.update();
	}

	function updatePresenceGraph(users) {
		graphs.presence.segments[0].value = users.categories;
		graphs.presence.segments[1].value = users.topics;
		graphs.presence.segments[2].value = users.category;
		graphs.presence.segments[3].value = users.recent;
		graphs.presence.segments[4].value = users.unread;


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
			for (var i = segments.length - 1; i >= 0; i--) {
				if (!segments[i]) {
					continue;
				}

				var tid = segments[i].tid;

				if ($.inArray(tid, tids) === -1) {
					usedTopicColors.splice($.inArray(segments[i].fillColor, usedTopicColors), 1);
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

			segments.sort(function(a, b) {
				return b.value - a.value;
			});
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

	function setupRealtimeButton() {
		$('#toggle-realtime .fa').on('click', function() {
			var $this = $(this);
			if ($this.hasClass('fa-toggle-on')) {
				$this.removeClass('fa-toggle-on').addClass('fa-toggle-off');
				$this.parent().find('strong').html('OFF');
				initiateDashboard(false);
			} else {
				$this.removeClass('fa-toggle-off').addClass('fa-toggle-on');
				$this.parent().find('strong').html('ON');
				initiateDashboard(true);
			}
		});
	}

	function initiateDashboard(realtime) {
		clearInterval(intervals.rooms);
		clearInterval(intervals.graphs);

		intervals.rooms = setInterval(function() {
			if (app.isFocused && app.isConnected) {
				socket.emit('admin.rooms.getAll', Admin.updateRoomUsage);
			}
		}, realtime ? DEFAULTS.realtimeInterval : DEFAULTS.roomInterval);

		intervals.graphs = setInterval(function() {
			updateTrafficGraph(currentGraph.units, currentGraph.until);
		}, realtime ? DEFAULTS.realtimeInterval : DEFAULTS.graphInterval);
	}

	return Admin;
});
