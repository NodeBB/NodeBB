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
	PieController,
	ArcElement,
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
	Legend,
	PieController,
	ArcElement
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

const pieColors = [
	'#5954e8', '#7892a4', '#a3b56c', '#ab4642',
	'#d4a017', '#28a745', '#dc3545', '#6f42c1',
	'#e83e8c', '#fd7e14', '#20c997', '#17a2b8',
];

export async function init() {
	charts = await initializeCharts();

	await renderActivitiesByTypeLegend();

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
		chart.data.datasets[0].data = data.data[name];
		chart.data.datasets[1].data = data.data[`${name}Err`];
		chart.update();
	});
}

async function renderActivitiesByTypeLegend() {
	const legendEl = document.getElementById('activitiesByTypeLegend');
	if (!legendEl) return;

	const byType = ajaxify.data.data.byType;
	const total = Object.values(byType).reduce((sum, v) => sum + v, 0);

	const entries = Object.entries(byType)
		.filter(([type, count]) => count > 0)
		.sort(([, a], [, b]) => b - a);

	const items = entries.map(([type, count], idx) => {
		const color = pieColors[idx % pieColors.length];
		const pct = total > 0 ? ((count / total) * 100).toFixed(1) : 0;
		return `<li class="mb-2">
			<span class="badge me-2" style="background-color: ${color};">&nbsp;</span>
			<span>${type}</span>
			<span class="float-end ms-2">${count} (${pct}%)</span>
		</li>`;
	}).join('');

	legendEl.innerHTML = items;
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
					data: ajaxify.data.data.received,
				},
				{
					...commonDataSetOpts,
					label: await translate('[[admin/settings/activitypub:analytics.errors]]'),
					backgroundColor: 'rgba(171,70,66,0.2)',
					borderColor: 'rgba(171,70,66,1)',
					pointBackgroundColor: 'rgba(171,70,66,1)',
					pointHoverBorderColor: 'rgba(171,70,66,1)',
					data: ajaxify.data.data.receivedErr,
				},
			],
		},
		'sent': {
			labels: labels.get('hourly'),
			datasets: [
				{
					...commonDataSetOpts,
					label: await translate('[[admin/settings/activitypub:analytics.sent]]'),
					backgroundColor: 'rgba(161,181,108,0.2)',
					borderColor: 'rgba(161,181,108,1)',
					pointBackgroundColor: 'rgba(161,181,108,1)',
					pointHoverBorderColor: 'rgba(161,181,108,1)',
					data: ajaxify.data.data.sent,
				},
				{
					...commonDataSetOpts,
					label: await translate('[[admin/settings/activitypub:analytics.errors]]'),
					backgroundColor: 'rgba(171,70,66,0.2)',
					borderColor: 'rgba(171,70,66,1)',
					pointBackgroundColor: 'rgba(171,70,66,1)',
					pointHoverBorderColor: 'rgba(171,70,66,1)',
					data: ajaxify.data.data.sentErr,
				},
			],
		},
	};

	receivedCanvas.width = $(receivedCanvas).parent().width();
	sentCanvas.width = $(sentCanvas).parent().width();

	const pieCanvas = document.getElementById('activitiesByType');
	if (pieCanvas) {
		pieCanvas.width = $(pieCanvas).parent().width();
	}

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

	const byType = ajaxify.data.data.byType;
	const pieEntries = Object.entries(byType)
		.filter(([, count]) => count > 0)
		.sort(([, a], [, b]) => b - a);
	const noDataContainer = $(pieCanvas).closest('.no-data-container');
	const noDataMessage = noDataContainer.find('.no-data-message');

	if (pieEntries.length === 0) {
		pieCanvas.style.display = 'none';
		noDataMessage.css('display', 'block');
		noDataContainer.css({
			display: 'flex',
			alignItems: 'center',
			justifyContent: 'center',
		});
	}

	const pieData = {
		labels: pieEntries.map(([type]) => type),
		datasets: [{
			data: pieEntries.map(([, count]) => count),
			backgroundColor: pieEntries.map(([, count], idx) =>
				pieColors[idx % pieColors.length]
			),
		}],
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
		['activitiesByType', new Chart(pieCanvas.getContext('2d'), {
			type: 'pie',
			data: pieData,
			options: {
				responsive: true,
				animation: false,
				plugins: {
					legend: {
						display: false,
					},
				},
			},
		})],
	]);
}

