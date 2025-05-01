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

import * as bootbox from 'bootbox';
import * as alerts from '../../modules/alerts';

Chart.register(
	LineController,
	CategoryScale,
	LinearScale,
	LineElement,
	PointElement,
	Tooltip,
	Filler
);


export function init() {
	setupCharts();

	$('[data-action="clear"]').on('click', clear404);
}

function clear404() {
	bootbox.confirm('[[admin/advanced/errors:clear404-confirm]]', function (ok) {
		if (ok) {
			socket.emit('admin.errors.clear', {}, function (err) {
				if (err) {
					return alerts.error(err);
				}

				ajaxify.refresh();
				alerts.success('[[admin/advanced/errors:clear404-success]]');
			});
		}
	});
}

function setupCharts() {
	const notFoundCanvas = document.getElementById('not-found');
	const tooBusyCanvas = document.getElementById('toobusy');
	let dailyLabels = utils.getDaysArray();

	dailyLabels = dailyLabels.slice(-7);

	if (utils.isMobile()) {
		Chart.defaults.plugins.tooltip.enabled = false;
	}

	const data = {
		'not-found': {
			labels: dailyLabels,
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
					data: ajaxify.data.analytics['not-found'],
				},
			],
		},
		toobusy: {
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
					data: ajaxify.data.analytics.toobusy,
				},
			],
		},
	};
	const chartOptions = {
		responsive: true,
		scales: {
			y: {
				beginAtZero: true,
			},
		},
		plugins: {
			legend: {
				display: false,
			},
		},
	};

	new Chart(notFoundCanvas.getContext('2d'), {
		type: 'line',
		data: data['not-found'],
		options: chartOptions,
	});

	new Chart(tooBusyCanvas.getContext('2d'), {
		type: 'line',
		data: data.toobusy,
		options: chartOptions,
	});
}
