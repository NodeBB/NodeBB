'use strict';

import { post, del } from 'api';
import { error } from 'alerts';
import { render } from 'benchpress';
import { get } from 'api';
import { translate } from 'translator';
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

let chart;
const labels = new Map([
	['hourly', utils.getHoursArray().map(function (text, idx) {
		return idx % 3 ? '' : text;
	})],
	['daily', utils.getDaysArray().map(function (text, idx) {
		return idx % 3 ? '' : text;
	})],
]);

export async function init() {
	setupRelays();
	chart = await initializeCharts();

	const hostFilterEl = document.getElementById('hostFilter');
	const termEl = document.getElementById('term');
	if (hostFilterEl) {
		hostFilterEl.addEventListener('change', updateCharts);
	}
	if (termEl) {
		termEl.addEventListener('change', updateCharts);
	}
};

function setupRelays() {
	const relaysEl = document.getElementById('relays');
	if (relaysEl) {
		relaysEl.addEventListener('click', (e) => {
			const subselector = e.target.closest('[data-action]');
			if (subselector) {
				const action = subselector.getAttribute('data-action');
				switch (action) {
					case 'relays.add': {
						throwModal();
						break;
					}

					case 'relays.remove': {
						const url = subselector.closest('tr').getAttribute('data-url');
						del(`/admin/activitypub/relays/${encodeURIComponent(url)}`, {}).then(async (data) => {
							const html = await app.parseAndTranslate('admin/federation/relays', 'relays', { relays: data });
							const tbodyEl = document.querySelector('#relays tbody');
							if (tbodyEl) {
								$(tbodyEl).html(html);
							}
						}).catch(error);
					}
				}
			}
		});
	}
}

function throwModal() {
	render('admin/partials/activitypub/relays', {}).then(function (html) {
		const submit = function () {
			const formEl = modal.find('form').get(0);
			if (!formEl.reportValidity()) {
				return false;
			}

			const payload = Object.fromEntries(new FormData(formEl));
			post('/admin/activitypub/relays', payload).then(async (data) => {
				const html = await app.parseAndTranslate('admin/federation/relays', 'relays', { relays: data });
				const tbodyEl = document.querySelector('#relays tbody');
				if (tbodyEl) {
					$(tbodyEl).html(html);
				}
			}).catch(error);
		};
		const modal = bootbox.dialog({
			title: '[[admin/settings/activitypub:relays.add]]',
			message: html,
			buttons: {
				save: {
					label: '[[global:save]]',
					className: 'btn-primary',
					callback: submit,
				},
			},
		});

		modal.on('shown.bs.modal', function () {
			modal.find('input').focus();
		});
	});
}

async function updateCharts() {
	const hostFilterEl = document.getElementById('hostFilter');
	const termEl = document.getElementById('term');
	console.log(hostFilterEl.value, termEl.value);
	const data = await get(`/api${ajaxify.data.url}?relay=${hostFilterEl.value}&term=${termEl.value}`);

	chart.data.labels = labels.get(termEl.value || 'hourly');
	chart.data.datasets[0].data = data.data.in;
	chart.data.datasets[1].data = data.data.out;
	chart.update();
}

async function initializeCharts() {
	const canvas = document.querySelector('canvas');

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
		labels: labels.get('hourly'),
		datasets: [
			{
				...commonDataSetOpts,
				label: await translate('[[admin/settings/activitypub:analytics.in]]'),
				backgroundColor: 'rgba(161,181,108,0.2)',
				borderColor: 'rgba(161,181,108,1)',
				pointBackgroundColor: 'rgba(161,181,108,1)',
				pointHoverBorderColor: 'rgba(161,181,108,1)',
				data: ajaxify.data.data.in,
			},
			{
				...commonDataSetOpts,
				label: await translate('[[admin/settings/activitypub:analytics.out]]'),
				backgroundColor: 'rgba(151,187,205,0.2)',
				borderColor: 'rgba(151,187,205,1)',
				pointBackgroundColor: 'rgba(151,187,205,1)',
				pointHoverBorderColor: 'rgba(151,187,205,1)',
				data: ajaxify.data.data.out,
			},
		],
	};

	canvas.width = $(canvas).parent().width();

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

	return new Chart(canvas.getContext('2d'), {
		type: 'line',
		data,
		options: chartOpts,
	});
}
