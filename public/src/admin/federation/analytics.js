import {
	Chart,
	LineController,
	CategoryScale,
	LinearScale,
	LineElement,
	PointElement,
	Tooltip,
	Filler,
	Legend,
} from 'chart.js';

import { get } from 'api';
import { translate } from 'translator';

Chart.register(
	LineController,
	CategoryScale,
	LinearScale,
	LineElement,
	PointElement,
	Tooltip,
	Filler,
	Legend
);

let charts;
const labels = new Map([
	['hourly', utils.getHoursArray().map(function (text, idx) {
		return idx % 3 ? '' : text;
	})],
	['daily', utils.getDaysArray().map(function (text, idx) {
		return idx % 3 ? '' : text;
	})],
]);

export function init() {
	charts = initializeCharts();

	const hostFilterEl = document.getElementById('hostFilter');
	const termEl = document.getElementById('term');
	if (hostFilterEl) {
		hostFilterEl.addEventListener('change', updateCharts);
	}
	if (termEl) {
		termEl.addEventListener('change', updateCharts);
	}
}

async function updateCharts() {
	const hostFilterEl = document.getElementById('hostFilter');
	const termEl = document.getElementById('term');
	const data = await get(`/api${ajaxify.data.url}?host=${hostFilterEl.value}&term=${termEl.value}`);

	['received', 'sent'].forEach((name) => {
		const chart = charts.get(name);
		chart.data.labels = labels.get(termEl.value || 'hourly');
		chart.data.datasets[0].data = data[name];
		chart.update();
	});
}

async function initializeCharts() {
	const receivedCanvas = document.getElementById('received');
	const sentCanvas = document.getElementById('sent');

	if (utils.isMobile()) {
		Chart.defaults.plugins.tooltip.enabled = false;
	}

	const commonDataSetOpts = {
		label: '',
		fill: true,
		tension: 0.25,
		pointHoverBackgroundColor: '#fff',
		pointBorderColor: '#fff',
	};

	const data = {
		'received': {
			labels: labels.get('hourly'),
			datasets: [
				{
					...commonDataSetOpts,
					label: await translate('[[admin/settings/activitypub:analytics.received]]'),
					backgroundColor: 'rgba(161,181,108,0.2)',
					borderColor: 'rgba(161,181,108,1)',
					pointBackgroundColor: 'rgba(161,181,108,1)',
					pointHoverBorderColor: 'rgba(161,181,108,1)',
					data: ajaxify.data.received,
				},
				{
					...commonDataSetOpts,
					label: await translate('[[admin/settings/activitypub:analytics.errors]]'),
					backgroundColor: 'rgba(171,70,66,0.2)',
					borderColor: 'rgba(171,70,66,1)',
					pointBackgroundColor: 'rgba(171,70,66,1)',
					pointHoverBorderColor: 'rgba(171,70,66,1)',
					data: ajaxify.data.receivedErr,
				},
			],
		},
		'sent': {
			labels: labels.get('hourly'),
			datasets: [
				{
					...commonDataSetOpts,
					label: await translate('[[admin/settings/activitypub:analytics.sent]]'),
					backgroundColor: 'rgba(151,187,205,0.2)',
					borderColor: 'rgba(151,187,205,1)',
					pointBackgroundColor: 'rgba(151,187,205,1)',
					pointHoverBorderColor: 'rgba(151,187,205,1)',
					data: ajaxify.data.sent,
				},
			],
		},
	};

	receivedCanvas.width = $(receivedCanvas).parent().width();
	sentCanvas.width = $(sentCanvas).parent().width();

	const chartOpts = {
		responsive: true,
		animation: false,
		scales: {
			y: {
				beginAtZero: true,
			},
		},
		plugins: {
			legend: {
				position: 'bottom',
			},
		},
	};

	return new Map([
		['received', new Chart(receivedCanvas.getContext('2d'), {
			type: 'line',
			data: data.received,
			options: chartOpts,
		})],
		['sent', new Chart(sentCanvas.getContext('2d'), {
			type: 'line',
			data: data.sent,
			options: chartOpts,
		})],
	]);
}

