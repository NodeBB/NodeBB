'use strict';

/* globals define */

define('forum/flags/list', ['components', 'Chart'], function (components, Chart) {
	var Flags = {};

	Flags.init = function () {
		Flags.enableFilterForm();
		Flags.enableChatButtons();
		Flags.handleGraphs();
	};

	Flags.enableFilterForm = function () {
		var filtersEl = components.get('flags/filters');

		// Parse ajaxify data to set form values to reflect current filters
		for (var filter in ajaxify.data.filters) {
			if (ajaxify.data.filters.hasOwnProperty(filter)) {
				filtersEl.find('[name="' + filter + '"]').val(ajaxify.data.filters[filter]);
			}
		}

		filtersEl.find('button').on('click', function () {
			var payload = filtersEl.serializeArray().filter(function (item) {
				return !!item.value;
			});
			ajaxify.go('flags?' + $.param(payload));
		});
	};

	Flags.enableChatButtons = function () {
		$('[data-chat]').on('click', function () {
			app.newChat(this.getAttribute('data-chat'));
		});
	};

	Flags.handleGraphs = function () {
		var dailyCanvas = document.getElementById('flags:daily');
		var dailyLabels = utils.getDaysArray().map(function (text, idx) {
			return idx % 3 ? '' : text;
		});

		if (utils.isMobile()) {
			Chart.defaults.global.tooltips.enabled = false;
		}
		var data = {
			'flags:daily': {
				labels: dailyLabels,
				datasets: [
					{
						label: '',
						backgroundColor: 'rgba(151,187,205,0.2)',
						borderColor: 'rgba(151,187,205,1)',
						pointBackgroundColor: 'rgba(151,187,205,1)',
						pointHoverBackgroundColor: '#fff',
						pointBorderColor: '#fff',
						pointHoverBorderColor: 'rgba(151,187,205,1)',
						data: ajaxify.data.analytics,
					},
				],
			},
		};

		dailyCanvas.width = $(dailyCanvas).parent().width();
		new Chart(dailyCanvas.getContext('2d'), {
			type: 'line',
			data: data['flags:daily'],
			options: {
				responsive: true,
				animation: false,
				legend: {
					display: false,
				},
				scales: {
					yAxes: [{
						ticks: {
							beginAtZero: true,
						},
					}],
				},
			},
		});
	};

	return Flags;
});
