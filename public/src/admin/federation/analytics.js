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

import { get } from 'api';

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
	const charts = initializeCharts();

	const hostFilterEl = document.getElementById('hostFilter');
	if (hostFilterEl) {
		hostFilterEl.addEventListener('change', async function () {
			const { activities } = await get(`/api${ajaxify.data.url}?host=${this.value}`);
			const chart = charts.get('activities');
			chart.data.datasets[0].data = activities;
			chart.update();
		});
	}
}

function initializeCharts() {
	const activitiesCanvas = document.getElementById('activities');
	// const dailyCanvas = document.getElementById('pageviews:daily');
	// const topicsCanvas = document.getElementById('topics:daily');
	// const postsCanvas = document.getElementById('posts:daily');
	const hourlyLabels = utils.getHoursArray().map(function (text, idx) {
		return idx % 3 ? '' : text;
	});
	// const dailyLabels = utils.getDaysArray().map(function (text, idx) {
	// 	return idx % 3 ? '' : text;
	// });

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
		'activities': {
			labels: hourlyLabels,
			datasets: [
				{
					...commonDataSetOpts,
					backgroundColor: 'rgba(186,139,175,0.2)',
					borderColor: 'rgba(186,139,175,1)',
					pointBackgroundColor: 'rgba(186,139,175,1)',
					pointHoverBorderColor: 'rgba(186,139,175,1)',
					data: ajaxify.data.activities,
				},
			],
		},
		// 'pageviews:daily': {
		// 	labels: dailyLabels,
		// 	datasets: [
		// 		{
		// 			...commonDataSetOpts,
		// 			backgroundColor: 'rgba(151,187,205,0.2)',
		// 			borderColor: 'rgba(151,187,205,1)',
		// 			pointBackgroundColor: 'rgba(151,187,205,1)',
		// 			pointHoverBorderColor: 'rgba(151,187,205,1)',
		// 			data: ajaxify.data.analytics['pageviews:daily'],
		// 		},
		// 	],
		// },
		// 'topics:daily': {
		// 	labels: dailyLabels.slice(-7),
		// 	datasets: [
		// 		{
		// 			...commonDataSetOpts,
		// 			backgroundColor: 'rgba(171,70,66,0.2)',
		// 			borderColor: 'rgba(171,70,66,1)',
		// 			pointBackgroundColor: 'rgba(171,70,66,1)',
		// 			pointHoverBorderColor: 'rgba(171,70,66,1)',
		// 			data: ajaxify.data.analytics['topics:daily'],
		// 		},
		// 	],
		// },
		// 'posts:daily': {
		// 	labels: dailyLabels.slice(-7),
		// 	datasets: [
		// 		{
		// 			...commonDataSetOpts,
		// 			backgroundColor: 'rgba(161,181,108,0.2)',
		// 			borderColor: 'rgba(161,181,108,1)',
		// 			pointBackgroundColor: 'rgba(161,181,108,1)',
		// 			pointHoverBorderColor: 'rgba(161,181,108,1)',
		// 			data: ajaxify.data.analytics['posts:daily'],
		// 		},
		// 	],
		// },
	};

	activitiesCanvas.width = $(activitiesCanvas).parent().width();
	// dailyCanvas.width = $(dailyCanvas).parent().width();
	// topicsCanvas.width = $(topicsCanvas).parent().width();
	// postsCanvas.width = $(postsCanvas).parent().width();

	const chartOpts = {
		responsive: true,
		animation: false,
		scales: {
			y: {
				beginAtZero: true,
			},
		},
	};

	return new Map([
		['activities', new Chart(activitiesCanvas.getContext('2d'), {
			type: 'line',
			data: data.activities,
			options: chartOpts,
		})],
	]);

	// new Chart(dailyCanvas.getContext('2d'), {
	// 	type: 'line',
	// 	data: data['pageviews:daily'],
	// 	options: chartOpts,
	// });

	// new Chart(topicsCanvas.getContext('2d'), {
	// 	type: 'line',
	// 	data: data['topics:daily'],
	// 	options: chartOpts,
	// });

	// new Chart(postsCanvas.getContext('2d'), {
	// 	type: 'line',
	// 	data: data['posts:daily'],
	// 	options: chartOpts,
	// });
}

