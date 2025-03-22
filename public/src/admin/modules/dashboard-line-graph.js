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
import * as translator from '../../modules/translator';
import * as api from '../../modules/api';
import * as hooks from '../../modules/hooks';


Chart.register(
	LineController,
	CategoryScale,
	LinearScale,
	LineElement,
	PointElement,
	Tooltip,
	Filler
);


let _current = null;
let isMobile = false;

export function init({ set, dataset }) {
	const canvas = document.getElementById('analytics-traffic');
	const canvasCtx = canvas.getContext('2d');
	const trafficLabels = utils.getHoursArray();

	isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
	if (isMobile) {
		Chart.defaults.plugins.tooltip.enabled = false;
	}

	handleUpdateControls({ set });

	const t = translator.Translator.create();
	return new Promise((resolve) => {
		t.translateKey(`admin/menu:${ajaxify.data.template.name.replace('admin/', '')}`, []).then((key) => {
			const data = {
				labels: trafficLabels,
				datasets: [
					{
						label: key,
						fill: true,
						tension: 0.25,
						backgroundColor: 'rgba(151,187,205,0.2)',
						borderColor: 'rgba(151,187,205,1)',
						pointBackgroundColor: 'rgba(151,187,205,1)',
						pointHoverBackgroundColor: 'rgba(151,187,205,1)',
						pointBorderColor: '#fff',
						pointHoverBorderColor: 'rgba(151,187,205,1)',
						data: dataset || [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
					},
				],
			};

			canvas.width = $(canvas).parent().width();

			data.datasets[0].yAxisID = 'left-y-axis';

			_current = new Chart(canvasCtx, {
				type: 'line',
				data: data,
				options: {
					responsive: true,
					scales: {
						'left-y-axis': {
							type: 'linear',
							position: 'left',
							beginAtZero: true,
							title: {
								display: true,
								text: key,
							},
						},
					},
					interaction: {
						intersect: false,
						mode: 'index',
					},
				},
			});

			if (!dataset) {
				update(set).then(resolve);
			} else {
				resolve(_current);
			}
		});
	});
}

function handleUpdateControls({ set }) {
	$('[data-action="updateGraph"]:not([data-units="custom"])').on('click', function () {
		let until = new Date();
		const amount = $(this).attr('data-amount');
		if ($(this).attr('data-units') === 'days') {
			until.setHours(0, 0, 0, 0);
		}
		until = until.getTime();
		update(set, $(this).attr('data-units'), until, amount);

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
					update(set, 'days');
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

				update(set, 'days', until, amount);

				// Update "custom range" label
				targetEl.attr('data-startRange', formData.startRange);
				targetEl.attr('data-endRange', formData.endRange);
				targetEl.html(formData.startRange + ' &ndash; ' + formData.endRange);
			}
		});
	});
}

function update(
	set,
	units = ajaxify.data.query.units || 'hours',
	until = ajaxify.data.query.until,
	amount = ajaxify.data.query.count
) {
	if (!_current) {
		return Promise.reject(new Error('[[error:invalid-data]]'));
	}

	return new Promise((resolve) => {
		api.get(`/admin/analytics/${set}`, { units, until, amount }).then((dataset) => {
			if (units === 'days') {
				_current.data.xLabels = utils.getDaysArray(until, amount);
			} else {
				_current.data.xLabels = utils.getHoursArray();
			}

			_current.data.datasets[0].data = dataset;
			_current.data.labels = _current.data.xLabels;
			_current.update();

			// Update address bar and "View as JSON" button url
			const apiEl = $('#view-as-json');
			const newHref = $.param({
				units: units || 'hours',
				until: until,
				count: amount,
			});
			apiEl.attr('href', `${config.relative_path}/api/v3/admin/analytics/${ajaxify.data.set}?${newHref}`);
			const url = ajaxify.removeRelativePath(ajaxify.data.url.slice(1));
			ajaxify.updateHistory(`${url}?${newHref}`, true);
			hooks.fire('action:admin.dashboard.updateGraph', {
				graph: _current,
			});
			resolve(_current);
		});
	});
}

