import {
	Chart,
	LineController,
	DoughnutController,
	CategoryScale,
	LinearScale,
	LineElement,
	PointElement,
	ArcElement,
	Tooltip,
	Filler,
	Legend,
} from 'chart.js';

import * as Benchpress from 'benchpressjs';
import * as bootbox from 'bootbox';
import * as alerts from '../modules/alerts';
import * as translator from '../modules/translator';
import { formattedNumber } from '../modules/helpers';

Chart.register(
	LineController,
	DoughnutController,
	CategoryScale,
	LinearScale,
	LineElement,
	PointElement,
	ArcElement,
	Tooltip,
	Filler,
	Legend
);

const intervals = {
	rooms: false,
	graphs: false,
};
let isMobile = false;
const graphData = {
	rooms: {},
	traffic: {},
};
const currentGraph = {
	units: 'hours',
	until: undefined,
};

const DEFAULTS = {
	roomInterval: 10000,
	graphInterval: 15000,
	realtimeInterval: 1500,
};

const usedTopicColors = [];

$(window).on('action:ajaxify.start', function () {
	clearInterval(intervals.rooms);
	clearInterval(intervals.graphs);

	intervals.rooms = null;
	intervals.graphs = null;
	graphData.rooms = null;
	graphData.traffic = null;
	usedTopicColors.length = 0;
});

export function init() {
	app.enterRoom('admin');

	isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);

	setupDarkModeButton();
	setupRealtimeButton();
	setupGraphs(function () {
		socket.emit('admin.rooms.getAll', updateRoomUsage);
		initiateDashboard();
	});
	setupFullscreen();
}

function updateRoomUsage(err, data) {
	if (err) {
		return alerts.error(err);
	}

	if (JSON.stringify(graphData.rooms) === JSON.stringify(data)) {
		return;
	}

	graphData.rooms = data;

	updateRegisteredGraph(data.onlineRegisteredCount, data.onlineGuestCount);
	updatePresenceGraph(data.users);
	updateTopicsGraph(data.topTenTopics);

	$('#active-users-loggedin').text(formattedNumber(data.onlineRegisteredCount));
	$('#active-users-guests').text(formattedNumber(data.onlineGuestCount));
	$('#active-users-total').text(formattedNumber(data.onlineRegisteredCount + data.onlineGuestCount));
	$('#active-users-connections').text(formattedNumber(data.socketCount));
}

const graphs = {
	traffic: null,
	registered: null,
	presence: null,
	topics: null,
};

const topicColors = [
	'#bf616a', '#5B90BF', '#d08770', '#ebcb8b',
	'#a3be8c', '#96b5b4', '#8fa1b3', '#b48ead',
	'#ab7967', '#46BFBD',
];

/* eslint-disable */
// from chartjs.org
function lighten(col, amt) {
	let usePound = false;

	if (col[0] === '#') {
		col = col.slice(1);
		usePound = true;
	}

	const num = parseInt(col, 16);

	let r = (num >> 16) + amt;

	if (r > 255) r = 255;
	else if (r < 0) r = 0;

	let b = ((num >> 8) & 0x00FF) + amt;

	if (b > 255) b = 255;
	else if (b < 0) b = 0;

	let g = (num & 0x0000FF) + amt;

	if (g > 255) g = 255;
	else if (g < 0) g = 0;

	return (usePound ? '#' : '') + (g | (b << 8) | (r << 16)).toString(16);
}
/* eslint-enable */

function setupGraphs(callback) {
	callback = callback || function () {};
	const trafficCanvas = document.getElementById('analytics-traffic');
	const registeredCanvas = document.getElementById('analytics-registered');
	const presenceCanvas = document.getElementById('analytics-presence');
	const topicsCanvas = document.getElementById('analytics-topics');
	const trafficCtx = trafficCanvas.getContext('2d');
	const registeredCtx = registeredCanvas.getContext('2d');
	const presenceCtx = presenceCanvas.getContext('2d');
	const topicsCtx = topicsCanvas.getContext('2d');
	const trafficLabels = utils.getHoursArray();

	if (isMobile) {
		Chart.defaults.plugins.tooltip.enabled = false;
	}

	const t = translator.Translator.create();
	Promise.all([
		t.translateKey('admin/dashboard:graphs.page-views', []),
		t.translateKey('admin/dashboard:graphs.page-views-registered', []),
		t.translateKey('admin/dashboard:graphs.page-views-guest', []),
		t.translateKey('admin/dashboard:graphs.page-views-bot', []),
		t.translateKey('admin/dashboard:graphs.page-views-ap', []),
		t.translateKey('admin/dashboard:graphs.unique-visitors', []),
		t.translateKey('admin/dashboard:graphs.registered-users', []),
		t.translateKey('admin/dashboard:graphs.guest-users', []),
		t.translateKey('admin/dashboard:on-categories', []),
		t.translateKey('admin/dashboard:reading-posts', []),
		t.translateKey('admin/dashboard:browsing-topics', []),
		t.translateKey('admin/dashboard:recent', []),
		t.translateKey('admin/dashboard:unread', []),
	]).then(function (translations) {
		const tension = 0.25;
		const data = {
			labels: trafficLabels,
			datasets: [
				{
					label: translations[0],
					fill: 'origin',
					tension: tension,
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
					fill: 'origin',
					tension: tension,
					backgroundColor: '#ab464233',
					borderColor: '#ab4642',
					pointBackgroundColor: '#ab4642',
					pointHoverBackgroundColor: '#ab4642',
					pointBorderColor: '#fff',
					pointHoverBorderColor: '#ab4642',
					data: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
				},
				{
					label: translations[2],
					fill: 'origin',
					tension: tension,
					backgroundColor: '#ba8baf33',
					borderColor: '#ba8baf',
					pointBackgroundColor: '#ba8baf',
					pointHoverBackgroundColor: '#ba8baf',
					pointBorderColor: '#fff',
					pointHoverBorderColor: '#ba8baf',
					data: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
				},
				{
					label: translations[3],
					fill: 'origin',
					tension: tension,
					backgroundColor: '#f7ca8833',
					borderColor: '#f7ca88',
					pointBackgroundColor: '#f7ca88',
					pointHoverBackgroundColor: '#f7ca88',
					pointBorderColor: '#fff',
					pointHoverBorderColor: '#f7ca88',
					data: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
				},
				{
					label: translations[4],
					fill: 'origin',
					tension: tension,
					backgroundColor: 'rgba(151,187,205,0.2)',
					borderColor: 'rgba(110, 187, 132, 1)',
					pointBackgroundColor: 'rgba(110, 187, 132, 1)',
					pointHoverBackgroundColor: 'rgba(110, 187, 132, 1)',
					pointBorderColor: '#fff',
					pointHoverBorderColor: 'rgba(110, 187, 132, 1)',
					data: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
				},
				{
					label: translations[5],
					fill: 'origin',
					tension: tension,
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
		data.datasets[1].yAxisID = 'left-y-axis';
		data.datasets[2].yAxisID = 'left-y-axis';
		data.datasets[3].yAxisID = 'left-y-axis';
		data.datasets[4].yAxisID = 'left-y-axis';
		data.datasets[5].yAxisID = 'right-y-axis';

		graphs.traffic = new Chart(trafficCtx, {
			type: 'line',
			data: data,
			options: {
				responsive: true,
				scales: {
					'left-y-axis': {
						position: 'left',
						type: 'linear',
						title: {
							display: true,
							text: translations[0],
						},
						beginAtZero: true,
					},
					'right-y-axis': {
						position: 'right',
						type: 'linear',
						title: {
							display: true,
							text: translations[5],
						},
						beginAtZero: true,
					},
				},
				plugins: {
					legend: {
						position: 'bottom',
					},
				},
				interaction: {
					intersect: false,
					mode: 'index',
				},
			},
		});

		const doughnutOpts = {
			responsive: true,
			plugins: {
				legend: {
					display: false,
				},
			},
		};
		graphs.registered = new Chart(registeredCtx, {
			type: 'doughnut',
			data: {
				labels: translations.slice(5, 7),
				datasets: [{
					data: [1, 1],
					backgroundColor: ['#F7464A', '#46BFBD'],
					hoverBackgroundColor: ['#FF5A5E', '#5AD3D1'],
				}],
			},
			options: doughnutOpts,
		});

		graphs.presence = new Chart(presenceCtx, {
			type: 'doughnut',
			data: {
				labels: translations.slice(7, 12),
				datasets: [{
					data: [1, 1, 1, 1, 1],
					backgroundColor: ['#F7464A', '#46BFBD', '#FDB45C', '#949FB1', '#9FB194'],
					hoverBackgroundColor: ['#FF5A5E', '#5AD3D1', '#FFC870', '#A8B3C5', '#A8B3C5'],
				}],
			},
			options: doughnutOpts,
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
			options: doughnutOpts,
		});

		updateTrafficGraph();

		$('[data-action="updateGraph"]:not([data-units="custom"])').on('click', function () {
			let until = new Date();
			const amount = $(this).attr('data-amount');
			if ($(this).attr('data-units') === 'days') {
				until.setHours(0, 0, 0, 0);
			}
			until = until.getTime();
			updateTrafficGraph($(this).attr('data-units'), until, amount);

			require(['translator'], function (translator) {
				translator.translate('[[admin/dashboard:page-views-custom]]', function (translated) {
					$('[data-action="updateGraph"][data-units="custom"]').text(translated);
				});
			});
		});

		$('[data-action="updateGraph"][data-units="custom"]').on('click', function () {
			const targetEl = $(this);

			Benchpress.render('admin/partials/pageviews-range-select', {}).then(function (html) {
				const modal = bootbox.dialog({
					title: '[[admin/dashboard:page-views-custom]]',
					message: html,
					buttons: {
						submit: {
							label: '[[global:search]]',
							className: 'btn-primary',
							callback: submit,
						},
					},
				}).on('shown.bs.modal', function () {
					const date = new Date();
					const today = date.toISOString().slice(0, 10);
					date.setDate(date.getDate() - 1);
					const yesterday = date.toISOString().slice(0, 10);

					modal.find('#startRange').val(targetEl.attr('data-startRange') || yesterday);
					modal.find('#endRange').val(targetEl.attr('data-endRange') || today);
				});

				function submit() {
					// NEED TO ADD VALIDATION HERE FOR YYYY-MM-DD
					const formData = modal.find('form').serializeObject();
					const validRegexp = /\d{4}-\d{2}-\d{2}/;

					// Input validation
					if (!formData.startRange && !formData.endRange) {
						// No range? Assume last 30 days
						updateTrafficGraph('days');
						return;
					} else if (!validRegexp.test(formData.startRange) || !validRegexp.test(formData.endRange)) {
						// Invalid Input
						modal.find('.alert-danger').removeClass('hidden');
						return false;
					}

					let until = new Date(formData.endRange);
					until.setDate(until.getDate() + 1);
					until = until.getTime();
					const amount = (until - new Date(formData.startRange).getTime()) / (1000 * 60 * 60 * 24);

					updateTrafficGraph('days', until, amount);

					// Update "custom range" label
					targetEl.attr('data-startRange', formData.startRange);
					targetEl.attr('data-endRange', formData.endRange);
					targetEl.html(formData.startRange + ' &ndash; ' + formData.endRange);
				}
			});
		});

		callback();
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
			return alerts.error(err);
		}
		if (JSON.stringify(graphData.traffic) === JSON.stringify(data)) {
			return;
		}

		graphData.traffic = data;

		if (units === 'days') {
			graphs.traffic.data.xLabels = utils.getDaysArray(until, amount);
		} else {
			graphs.traffic.data.xLabels = utils.getHoursArray();

			$('#pageViewsThirty').html(formattedNumber(data.summary.thirty));
			$('#pageViewsSeven').html(formattedNumber(data.summary.seven));
			$('#pageViewsPastDay').html(formattedNumber(data.pastDay));
		}

		graphs.traffic.data.datasets[0].data = data.pageviews;
		graphs.traffic.data.datasets[1].data = data.pageviewsRegistered;
		graphs.traffic.data.datasets[2].data = data.pageviewsGuest;
		graphs.traffic.data.datasets[3].data = data.pageviewsBot;
		graphs.traffic.data.datasets[4].data = data.appageviews;
		graphs.traffic.data.datasets[5].data = data.uniqueVisitors;
		graphs.traffic.data.labels = graphs.traffic.data.xLabels;

		graphs.traffic.update();
		currentGraph.units = units;
		currentGraph.until = until;
		currentGraph.amount = amount;

		// Update the View as JSON button url
		const apiEl = $('#view-as-json');
		const newHref = $.param({
			units: units || 'hours',
			until: until,
			count: amount,
		});
		apiEl.attr('href', config.relative_path + '/api/admin/analytics?' + newHref);
	});
}

function updateRegisteredGraph(registered, guest) {
	$('#analytics-legend .registered').parent().find('.count').text(registered);
	$('#analytics-legend .guest').parent().find('.count').text(guest);
	graphs.registered.data.datasets[0].data[0] = registered;
	graphs.registered.data.datasets[0].data[1] = guest;
	graphs.registered.update();
}

function updatePresenceGraph(users) {
	$('#analytics-presence-legend .on-categories').parent().find('.count').text(users.categories);
	$('#analytics-presence-legend .reading-posts').parent().find('.count').text(users.topics);
	$('#analytics-presence-legend .browsing-topics').parent().find('.count').text(users.category);
	$('#analytics-presence-legend .recent').parent().find('.count').text(users.recent);
	$('#analytics-presence-legend .unread').parent().find('.count').text(users.unread);
	graphs.presence.data.datasets[0].data[0] = users.categories;
	graphs.presence.data.datasets[0].data[1] = users.topics;
	graphs.presence.data.datasets[0].data[2] = users.category;
	graphs.presence.data.datasets[0].data[3] = users.recent;
	graphs.presence.data.datasets[0].data[4] = users.unread;

	graphs.presence.update();
}

function updateTopicsGraph(topics) {
	if (!topics.length) {
		translator.translate('[[admin/dashboard:no-users-browsing]]', function (translated) {
			topics = [{
				title: translated,
				count: 1,
			}];
			updateTopicsGraph(topics);
		});
		return;
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
		let html = '';
		topics.forEach(function (t, i) {
			const link = t.tid ? '<a title="' + t.title + '"href="' + config.relative_path + '/topic/' + t.tid + '" target="_blank"> ' + t.title + '</a>' : t.title;
			const label = t.count === '0' ? t.title : link;

			html += '<li>' +
				'<div style="background-color: ' + topicColors[i] + ';"></div>' +
				'<span> (' + t.count + ') ' + label + '</span>' +
				'</li>';
		});
		$('#topics-legend').translateHtml(html);
	}

	buildTopicsLegend();
	graphs.topics.update();
}

function setupDarkModeButton() {
	let bsTheme = localStorage.getItem('data-bs-theme') || 'light';
	$('#toggle-dark-mode').prop('checked', bsTheme === 'dark')
		.on('click', function () {
			const isChecked = $(this).is(':checked');
			bsTheme = isChecked ? 'dark' : 'light';
			$('html').attr('data-bs-theme', bsTheme);
			localStorage.setItem('data-bs-theme', bsTheme);
		});
}

function setupRealtimeButton() {
	$('#toggle-realtime').on('click', function () {
		initiateDashboard($(this).is(':checked'));
	});
}

function initiateDashboard(realtime) {
	clearInterval(intervals.rooms);
	clearInterval(intervals.graphs);

	intervals.rooms = setInterval(function () {
		if (app.isFocused && socket.connected) {
			socket.emit('admin.rooms.getAll', updateRoomUsage);
		}
	}, realtime ? DEFAULTS.realtimeInterval : DEFAULTS.roomInterval);

	intervals.graphs = setInterval(function () {
		updateTrafficGraph(currentGraph.units, currentGraph.until, currentGraph.amount);
	}, realtime ? DEFAULTS.realtimeInterval : DEFAULTS.graphInterval);
}

function setupFullscreen() {
	const container = document.getElementById('analytics-panel');
	const $container = $(container);
	const btn = $container.find('#expand-analytics');
	let fsMethod;
	let exitMethod;

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
