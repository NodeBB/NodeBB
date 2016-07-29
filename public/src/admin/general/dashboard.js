"use strict";
/*global define, ajaxify, app, socket, utils, bootbox, RELATIVE_PATH*/

define('admin/general/dashboard', ['semver', 'Chart'], function(semver, Chart) {
	var	Admin = {};
	var	intervals = {
			rooms: false,
			graphs: false
		};
	var	isMobile = false;
	var	isPrerelease = /^v?\d+\.\d+\.\d+-.+$/;
	var	graphData = {
			rooms: {},
			traffic: {}
		};
	var	currentGraph = {
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

	var topicColors = ["#bf616a","#5B90BF","#d08770","#ebcb8b","#a3be8c","#96b5b4","#8fa1b3","#b48ead","#ab7967","#46BFBD"];
	var	usedTopicColors = [];

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
					backgroundColor: "rgba(220,220,220,0.2)",
					borderColor: "rgba(220,220,220,1)",
					pointBackgroundColor: "rgba(220,220,220,1)",
					pointHoverBackgroundColor: "#fff",
					pointBorderColor: "#fff",
					pointHoverBorderColor: "rgba(220,220,220,1)",
					data: [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0]
				},
				{
					label: "Unique Visitors",
					backgroundColor: "rgba(151,187,205,0.2)",
					borderColor: "rgba(151,187,205,1)",
					pointBackgroundColor: "rgba(151,187,205,1)",
					pointHoverBackgroundColor: "#fff",
					pointBorderColor: "#fff",
					pointHoverBorderColor: "rgba(151,187,205,1)",
					data: [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0]
				}
			]
		};

		trafficCanvas.width = $(trafficCanvas).parent().width();
		graphs.traffic = new Chart(trafficCtx, {
			type: 'line',
			data: data,
			options: {
				responsive: true,
				legend: {
					display: false
				},
				scales: {
					yAxes: [{
						ticks: {
							beginAtZero: true
						}
					}]
				}
			}
		});
		
		graphs.registered = new Chart(registeredCtx, {
			type: 'doughnut',
			data: {
				labels: ["Registered Users", "Anonymous Users"],
				datasets: [{
					data: [1, 1],
					backgroundColor: ["#F7464A", "#46BFBD"],
					hoverBackgroundColor: ["#FF5A5E", "#5AD3D1"]
				}]
			},
			options: {
				responsive: true,
				legend: {
					display: false
				}
			}
		});

		graphs.presence = new Chart(presenceCtx, {
			type: 'doughnut',
			data: {
				labels: ["On categories list", "Reading posts", "Browsing topics", "Recent", "Unread"],
				datasets: [{
					data: [1, 1, 1, 1, 1],
					backgroundColor: ["#F7464A", "#46BFBD", "#FDB45C", "#949FB1", "#9FB194"],
					hoverBackgroundColor: ["#FF5A5E", "#5AD3D1", "#FFC870", "#A8B3C5", "#A8B3C5"]
				}]
 			},
 			options: {
				responsive: true,
				legend: {
					display: false
				}
 			}
		});
 			
		graphs.topics = new Chart(topicsCtx, {
			type: 'doughnut',
			data: {
				labels: [],
				datasets: [{
					data: [],
					backgroundColor: [],
					hoverBackgroundColor: []
				}]
			},
			options: {
				responsive: true,
				legend: {
					display: false
				}
 			}
		});

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

			if (units === 'days') {
				graphs.traffic.data.xLabels = utils.getDaysArray(until);
			} else {
				graphs.traffic.data.xLabels = utils.getHoursArray();

				$('#pageViewsThisMonth').html(data.monthlyPageViews.thisMonth);
				$('#pageViewsLastMonth').html(data.monthlyPageViews.lastMonth);
				$('#pageViewsPastDay').html(data.pastDay);
				utils.addCommasToNumbers($('#pageViewsThisMonth'));
				utils.addCommasToNumbers($('#pageViewsLastMonth'));
				utils.addCommasToNumbers($('#pageViewsPastDay'));
			}

			graphs.traffic.data.datasets[0].data = data.pageviews;
			graphs.traffic.data.datasets[1].data = data.uniqueVisitors;
			graphs.traffic.data.labels = graphs.traffic.data.xLabels;

			graphs.traffic.update();
			currentGraph.units = units;
			currentGraph.until = until;
		});
	}

	function updateRegisteredGraph(registered, anonymous) {
		graphs.registered.data.datasets[0].data[0] = registered;
		graphs.registered.data.datasets[0].data[1] = anonymous;
		graphs.registered.update();
	}

	function updatePresenceGraph(users) {
		graphs.presence.data.datasets[0].data[0] = users.categories;
		graphs.presence.data.datasets[0].data[1] = users.topics;
		graphs.presence.data.datasets[0].data[2] = users.category;
		graphs.presence.data.datasets[0].data[3] = users.recent;
		graphs.presence.data.datasets[0].data[4] = users.unread;

		graphs.presence.update();
	}
	
	function updateTopicsGraph(topics) {
		if (!Object.keys(topics).length) {
			topics = {"0": {
				title: "No users browsing",
				value: 1
			}};
		}

		var tids = Object.keys(topics);
		
		graphs.topics.data.labels = [];
		graphs.topics.data.datasets[0].data = [];
		graphs.topics.data.datasets[0].backgroundColor = [];
		graphs.topics.data.datasets[0].hoverBackgroundColor = [];
		
		for (var i = 0, ii = tids.length; i < ii; i++) {
			graphs.topics.data.labels.push(topics[tids[i]].title);
			graphs.topics.data.datasets[0].data.push(topics[tids[i]].value);
			graphs.topics.data.datasets[0].backgroundColor.push(topicColors[i]);
			graphs.topics.data.datasets[0].hoverBackgroundColor.push(lighten(topicColors[i], 10));
		}
 		
		function buildTopicsLegend() {
			var legend = $('#topics-legend').html('');

			for (var i = 0, ii = tids.length; i < ii; i++) {
				var topic = topics[tids[i]];
				var	label = topic.value === '0' ? topic.title : '<a title="' + topic.title + '"href="' + RELATIVE_PATH + '/topic/' + tids[i] + '" target="_blank"> ' + topic.title + '</a>';
			
				legend.append(
					'<li>' +
					'<div style="background-color: ' + topicColors[i] + ';"></div>' +
					'<span>' + label + '</span>' +
					'</li>');
			}
		}

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
