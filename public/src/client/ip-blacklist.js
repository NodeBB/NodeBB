import {
	Chart,
	LineController,
	CategoryScale,
	LinearScale,
	LineElement,
	PointElement,
	Tooltip,
	Filler,
} from 'chart.js';

import * as Benchpress from 'benchpressjs';
import * as bootbox from 'bootbox';
import * as alerts from '../modules/alerts';

Chart.register(LineController, CategoryScale, LinearScale, LineElement, PointElement, Tooltip, Filler);

export function init() {
	const blacklist = $('#blacklist-rules');

	blacklist.on('keyup', function () {
		$('#blacklist-rules-holder').val(blacklist.val());
	});

	$('[data-action="apply"]').on('click', function () {
		socket.emit('blacklist.save', blacklist.val(), function (err) {
			if (err) {
				return alerts.error(err);
			}
			alerts.alert({
				type: 'success',
				alert_id: 'blacklist-saved',
				title: '[[ip-blacklist:alerts.applied-success]]',
			});
		});
	});

	$('[data-action="test"]').on('click', function () {
		socket.emit('blacklist.validate', {
			rules: blacklist.val(),
		}, function (err, data) {
			if (err) {
				return alerts.error(err);
			}

			Benchpress.render('admin/partials/blacklist-validate', data).then(function (html) {
				bootbox.alert(html);
			});
		});
	});

	setupAnalytics();
}

export function setupAnalytics() {
	const hourlyCanvas = document.getElementById('blacklist:hourly');
	const dailyCanvas = document.getElementById('blacklist:daily');
	const hourlyLabels = utils.getHoursArray().map(function (text, idx) {
		return idx % 3 ? '' : text;
	});
	const dailyLabels = utils.getDaysArray().slice(-7).map(function (text, idx) {
		return idx % 3 ? '' : text;
	});

	if (utils.isMobile()) {
		Chart.defaults.plugins.tooltip.enabled = false;
	}

	const data = {
		'blacklist:hourly': {
			labels: hourlyLabels,
			datasets: [
				{
					label: '',
					fill: 'origin',
					tension: 0.25,
					backgroundColor: 'rgba(186,139,175,0.2)',
					borderColor: 'rgba(186,139,175,1)',
					pointBackgroundColor: 'rgba(186,139,175,1)',
					pointHoverBackgroundColor: '#fff',
					pointBorderColor: '#fff',
					pointHoverBorderColor: 'rgba(186,139,175,1)',
					data: ajaxify.data.analytics.hourly,
				},
			],
		},
		'blacklist:daily': {
			labels: dailyLabels,
			datasets: [
				{
					label: '',
					fill: 'origin',
					tension: 0.25,
					backgroundColor: 'rgba(151,187,205,0.2)',
					borderColor: 'rgba(151,187,205,1)',
					pointBackgroundColor: 'rgba(151,187,205,1)',
					pointHoverBackgroundColor: '#fff',
					pointBorderColor: '#fff',
					pointHoverBorderColor: 'rgba(151,187,205,1)',
					data: ajaxify.data.analytics.daily,
				},
			],
		},
	};

	const chartOpts = {
		responsive: true,
		scales: {
			y: {
				position: 'left',
				type: 'linear',
				beginAtZero: true,
			},
		},
	};

	new Chart(hourlyCanvas.getContext('2d'), {
		type: 'line',
		data: data['blacklist:hourly'],
		options: chartOpts,
	});

	new Chart(dailyCanvas.getContext('2d'), {
		type: 'line',
		data: data['blacklist:daily'],
		options: chartOpts,
	});
}

