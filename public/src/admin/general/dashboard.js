'use strict';


define('admin/general/dashboard', ['semver', 'Chart', 'translator', 'benchpress'], function (semver, Chart, translator, Benchpress) {
	var	Admin = {};
	var	intervals = {
		rooms: false,
		graphs: false,
	};
	var	isMobile = false;
	var	graphData = {
		rooms: {},
		traffic: {},
	};
	var	currentGraph = {
		units: 'hours',
		until: undefined,
	};

	var DEFAULTS = {
		roomInterval: 10000,
		graphInterval: 15000,
		realtimeInterval: 1500,
	};

	var	usedTopicColors = [];

	$(window).on('action:ajaxify.start', function () {
		clearInterval(intervals.rooms);
		clearInterval(intervals.graphs);

		intervals.rooms = null;
		intervals.graphs = null;
		graphData.rooms = null;
		graphData.traffic = null;
		usedTopicColors.length = 0;
	});

	Admin.init = function () {
		app.enterRoom('admin');

		isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);

		$('[data-toggle="tooltip"]').tooltip();

		setupRealtimeButton();
		setupGraphs(function () {
			socket.emit('admin.rooms.getAll', Admin.updateRoomUsage);
			initiateDashboard();
		});
		setupFullscreen();
	};

	Admin.updateRoomUsage = function (err, data) {
		if (err) {
			return app.alertError(err.message);
		}

		if (JSON.stringify(graphData.rooms) === JSON.stringify(data)) {
			return;
		}

		graphData.rooms = data;

		var html = '<div class="text-center pull-left">' +
						'<span class="formatted-number">' + data.onlineRegisteredCount + '</span>' +
						'<div class="stat">[[admin/general/dashboard:active-users.users]]</div>' +
					'</div>' +
					'<div class="text-center pull-left">' +
						'<span class="formatted-number">' + data.onlineGuestCount + '</span>' +
						'<div class="stat">[[admin/general/dashboard:active-users.guests]]</div>' +
					'</div>' +
					'<div class="text-center pull-left">' +
						'<span class="formatted-number">' + (data.onlineRegisteredCount + data.onlineGuestCount) + '</span>' +
						'<div class="stat">[[admin/general/dashboard:active-users.total]]</div>' +
					'</div>' +
					'<div class="text-center pull-left">' +
						'<span class="formatted-number">' + data.socketCount + '</span>' +
						'<div class="stat">[[admin/general/dashboard:active-users.connections]]</div>' +
					'</div>';

		updateRegisteredGraph(data.onlineRegisteredCount, data.onlineGuestCount);
		updatePresenceGraph(data.users);
		updateTopicsGraph(data.topTenTopics);

		$('#active-users').translateHtml(html);
	};

	var graphs = {
		traffic: null,
		registered: null,
		presence: null,
		topics: null,
	};

	var topicColors = ['#bf616a', '#5B90BF', '#d08770', '#ebcb8b', '#a3be8c', '#96b5b4', '#8fa1b3', '#b48ead', '#ab7967', '#46BFBD'];

	/* eslint-disable */
	// from chartjs.org
	function lighten(col, amt) {
		var usePound = false;

		if (col[0] === '#') {
			col = col.slice(1);
			usePound = true;
		}

		var num = parseInt(col, 16);

		var r = (num >> 16) + amt;

		if (r > 255) r = 255;
		else if (r < 0) r = 0;

		var b = ((num >> 8) & 0x00FF) + amt;

		if (b > 255) b = 255;
		else if (b < 0) b = 0;

		var g = (num & 0x0000FF) + amt;

		if (g > 255) g = 255;
		else if (g < 0) g = 0;

		return (usePound ? '#' : '') + (g | (b << 8) | (r << 16)).toString(16);
	}
	/* eslint-enable */

	function setupGraphs(callback) {
		callback = callback || function () {};
		var trafficCanvas = document.getElementById('analytics-traffic');
		var registeredCanvas = document.getElementById('analytics-registered');
		var presenceCanvas = document.getElementById('analytics-presence');
		var topicsCanvas = document.getElementById('analytics-topics');
		var trafficCtx = trafficCanvas.getContext('2d');
		var registeredCtx = registeredCanvas.getContext('2d');
		var presenceCtx = presenceCanvas.getContext('2d');
		var topicsCtx = topicsCanvas.getContext('2d');
		var trafficLabels = utils.getHoursArray();

		if (isMobile) {
			Chart.defaults.global.tooltips.enabled = false;
		}

		var t = translator.Translator.create();
		Promise.all([
			t.translateKey('admin/general/dashboard:graphs.page-views', []),
			t.translateKey('admin/general/dashboard:graphs.unique-visitors', []),
			t.translateKey('admin/general/dashboard:graphs.registered-users', []),
			t.translateKey('admin/general/dashboard:graphs.anonymous-users', []),
			t.translateKey('admin/general/dashboard:on-categories', []),
			t.translateKey('admin/general/dashboard:reading-posts', []),
			t.translateKey('admin/general/dashboard:browsing-topics', []),
			t.translateKey('admin/general/dashboard:recent', []),
			t.translateKey('admin/general/dashboard:unread', []),
		]).then(function (translations) {
			var data = {
				labels: trafficLabels,
				datasets: [
					{
						label: translations[0],
						backgroundColor: 'rgba(220,220,220,0.2)',
						borderColor: 'rgba(220,220,220,1)',
						pointBackgroundColor: 'rgba(220,220,220,1)',
						pointHoverBackgroundColor: '#fff',
						pointBorderColor: '#fff',
						pointHoverBorderColor: 'rgba(220,220,220,1)',
						data: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
					},
					{
						label: translations[1],
						backgroundColor: 'rgba(151,187,205,0.2)',
						borderColor: 'rgba(151,187,205,1)',
						pointBackgroundColor: 'rgba(151,187,205,1)',
						pointHoverBackgroundColor: 'rgba(151,187,205,1)',
						pointBorderColor: '#fff',
						pointHoverBorderColor: 'rgba(151,187,205,1)',
						data: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
					},
				],
			};

			trafficCanvas.width = $(trafficCanvas).parent().width();

			data.datasets[0].yAxisID = 'left-y-axis';
			data.datasets[1].yAxisID = 'right-y-axis';

			graphs.traffic = new Chart(trafficCtx, {
				type: 'line',
				data: data,
				options: {
					responsive: true,
					legend: {
						display: false,
					},
					scales: {
						yAxes: [{
							id: 'left-y-axis',
							ticks: {
								beginAtZero: true,
							},
							type: 'linear',
							position: 'left',
							scaleLabel: {
								display: true,
								labelString: translations[0],
							},
						}, {
							id: 'right-y-axis',
							ticks: {
								beginAtZero: true,
								suggestedMax: 10,
							},
							type: 'linear',
							position: 'right',
							scaleLabel: {
								display: true,
								labelString: translations[1],
							},
						}],
					},
					tooltips: {
						mode: 'x',
					},
				},
			});

			graphs.registered = new Chart(registeredCtx, {
				type: 'doughnut',
				data: {
					labels: translations.slice(2, 4),
					datasets: [{
						data: [1, 1],
						backgroundColor: ['#F7464A', '#46BFBD'],
						hoverBackgroundColor: ['#FF5A5E', '#5AD3D1'],
					}],
				},
				options: {
					responsive: true,
					legend: {
						display: false,
					},
				},
			});

			graphs.presence = new Chart(presenceCtx, {
				type: 'doughnut',
				data: {
					labels: translations.slice(4, 9),
					datasets: [{
						data: [1, 1, 1, 1, 1],
						backgroundColor: ['#F7464A', '#46BFBD', '#FDB45C', '#949FB1', '#9FB194'],
						hoverBackgroundColor: ['#FF5A5E', '#5AD3D1', '#FFC870', '#A8B3C5', '#A8B3C5'],
					}],
				},
				options: {
					responsive: true,
					legend: {
						display: false,
					},
				},
			});

			graphs.topics = new Chart(topicsCtx, {
				type: 'doughnut',
				data: {
					labels: [],
					datasets: [{
						data: [],
						backgroundColor: [],
						hoverBackgroundColor: [],
					}],
				},
				options: {
					responsive: true,
					legend: {
						display: false,
					},
				},
			});

			updateTrafficGraph();

			$(window).on('resize', adjustPieCharts);
			adjustPieCharts();

			$('[data-action="updateGraph"]:not([data-units="custom"])').on('click', function () {
				var until = new Date();
				var amount = $(this).attr('data-amount');
				if ($(this).attr('data-units') === 'days') {
					until.setHours(0, 0, 0, 0);
				}
				until = until.getTime();
				updateTrafficGraph($(this).attr('data-units'), until, amount);
				$('[data-action="updateGraph"]').removeClass('active');
				$(this).addClass('active');

				require(['translator'], function (translator) {
					translator.translate('[[admin/general/dashboard:page-views-custom]]', function (translated) {
						$('[data-action="updateGraph"][data-units="custom"]').text(translated);
					});
				});
			});

			$('[data-action="updateGraph"][data-units="custom"]').on('click', function () {
				var targetEl = $(this);

				Benchpress.parse('admin/partials/pageviews-range-select', {}, function (html) {
					var modal = bootbox.dialog({
						title: '[[admin/general/dashboard:page-views-custom]]',
						message: html,
						buttons: {
							submit: {
								label: '[[global:search]]',
								className: 'btn-primary',
								callback: submit,
							},
						},
					}).on('shown.bs.modal', function () {
						var date = new Date();
						var today = date.toISOString().substr(0, 10);
						date.setDate(date.getDate() - 1);
						var yesterday = date.toISOString().substr(0, 10);

						modal.find('#startRange').val(targetEl.attr('data-startRange') || yesterday);
						modal.find('#endRange').val(targetEl.attr('data-endRange') || today);
					});

					function submit() {
						// NEED TO ADD VALIDATION HERE FOR YYYY-MM-DD
						var formData = modal.find('form').serializeObject();
						var validRegexp = /\d{4}-\d{2}-\d{2}/;

						// Input validation
						if (!formData.startRange && !formData.endRange) {
							// No range? Assume last 30 days
							updateTrafficGraph('days');
							$('[data-action="updateGraph"]').removeClass('active');
							$('[data-action="updateGraph"][data-units="days"]').addClass('active');
							return;
						} else if (!validRegexp.test(formData.startRange) || !validRegexp.test(formData.endRange)) {
							// Invalid Input
							modal.find('.alert-danger').removeClass('hidden');
							return false;
						}

						var until = new Date(formData.endRange);
						until.setDate(until.getDate() + 1);
						until = until.getTime();
						var amount = (until - new Date(formData.startRange).getTime()) / (1000 * 60 * 60 * 24);

						updateTrafficGraph('days', until, amount);
						$('[data-action="updateGraph"]').removeClass('active');
						targetEl.addClass('active');

						// Update "custom range" label
						targetEl.attr('data-startRange', formData.startRange);
						targetEl.attr('data-endRange', formData.endRange);
						targetEl.html(formData.startRange + ' &ndash; ' + formData.endRange);
					}
				});
			});

			socket.emit('admin.rooms.getAll', Admin.updateRoomUsage);
			initiateDashboard();
			callback();
		});
	}

	function adjustPieCharts() {
		$('.pie-chart.legend-up').each(function () {
			var $this = $(this);

			if ($this.width() < 320) {
				$this.addClass('compact');
			} else {
				$this.removeClass('compact');
			}
		});
	}

	function updateTrafficGraph(units, until, amount) {
		// until and amount are optional

		if (!app.isFocused) {
			return;
		}

		socket.emit('admin.analytics.get', {
			graph: 'traffic',
			units: units || 'hours',
			until: until,
			amount: amount,
		}, function (err, data) {
			if (err) {
				return app.alertError(err.message);
			}
			if (JSON.stringify(graphData.traffic) === JSON.stringify(data)) {
				return;
			}

			graphData.traffic = data;

			if (units === 'days') {
				graphs.traffic.data.xLabels = utils.getDaysArray(until, amount);
			} else {
				graphs.traffic.data.xLabels = utils.getHoursArray();

				$('#pageViewsThirty').html(data.summary.thirty);
				$('#pageViewsSeven').html(data.summary.seven);
				$('#pageViewsPastDay').html(data.pastDay);
				utils.addCommasToNumbers($('#pageViewsThirty'));
				utils.addCommasToNumbers($('#pageViewsSeven'));
				utils.addCommasToNumbers($('#pageViewsPastDay'));
			}

			graphs.traffic.data.datasets[0].data = data.pageviews;
			graphs.traffic.data.datasets[1].data = data.uniqueVisitors;
			graphs.traffic.data.labels = graphs.traffic.data.xLabels;

			graphs.traffic.update();
			currentGraph.units = units;
			currentGraph.until = until;
			currentGraph.amount = amount;
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
		if (!topics.length) {
			topics = [{
				title: '[[admin/general/dashboard:no-users-browsing]]',
				count: 1,
			}];
		}

		graphs.topics.data.labels = [];
		graphs.topics.data.datasets[0].data = [];
		graphs.topics.data.datasets[0].backgroundColor = [];
		graphs.topics.data.datasets[0].hoverBackgroundColor = [];

		topics.forEach(function (topic, i) {
			graphs.topics.data.labels.push(topic.title);
			graphs.topics.data.datasets[0].data.push(topic.count);
			graphs.topics.data.datasets[0].backgroundColor.push(topicColors[i]);
			graphs.topics.data.datasets[0].hoverBackgroundColor.push(lighten(topicColors[i], 10));
		});

		function buildTopicsLegend() {
			var legend = $('#topics-legend').html('');
			var html = '';
			topics.forEach(function (topic, i) {
				var	label = topic.count === '0' ? topic.title : '<a title="' + topic.title + '"href="' + RELATIVE_PATH + '/topic/' + topic.tid + '" target="_blank"> ' + topic.title + '</a>';

				html += '<li>' +
					'<div style="background-color: ' + topicColors[i] + ';"></div>' +
					'<span>' + label + '</span>' +
					'</li>';
			});
			legend.translateHtml(html);
		}

		buildTopicsLegend();
		graphs.topics.update();
	}

	function setupRealtimeButton() {
		$('#toggle-realtime .fa').on('click', function () {
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

		intervals.rooms = setInterval(function () {
			if (app.isFocused && app.isConnected) {
				socket.emit('admin.rooms.getAll', Admin.updateRoomUsage);
			}
		}, realtime ? DEFAULTS.realtimeInterval : DEFAULTS.roomInterval);

		intervals.graphs = setInterval(function () {
			updateTrafficGraph(currentGraph.units, currentGraph.until, currentGraph.amount);
		}, realtime ? DEFAULTS.realtimeInterval : DEFAULTS.graphInterval);
	}

	function setupFullscreen() {
		var container = document.getElementById('analytics-traffic-container');
		var $container = $(container);
		var btn = $container.find('.fa-expand');
		var fsMethod;
		var exitMethod;

		if (container.requestFullscreen) {
			fsMethod = 'requestFullscreen';
			exitMethod = 'exitFullscreen';
		} else if (container.mozRequestFullScreen) {
			fsMethod = 'mozRequestFullScreen';
			exitMethod = 'mozCancelFullScreen';
		} else if (container.webkitRequestFullscreen) {
			fsMethod = 'webkitRequestFullscreen';
			exitMethod = 'webkitCancelFullScreen';
		} else if (container.msRequestFullscreen) {
			fsMethod = 'msRequestFullscreen';
			exitMethod = 'msCancelFullScreen';
		}

		if (fsMethod) {
			btn.addClass('active');
			btn.on('click', function () {
				if ($container.hasClass('fullscreen')) {
					document[exitMethod]();
					$container.removeClass('fullscreen');
				} else {
					container[fsMethod]();
					$container.addClass('fullscreen');
				}
			});
		}
	}

	return Admin;
});
