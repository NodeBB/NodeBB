"use strict";
/*global config, define, app, socket, ajaxify, bootbox, templates, Chart, utils */

define('admin/advanced/errors', ['Chart'], function (Chart) {
	var Errors = {};

	Errors.init = function () {
		Errors.setupCharts();

		$('[data-action="clear"]').on('click', Errors.clear404);
	};

	Errors.clear404 = function () {
		bootbox.confirm('Are you sure you wish to clear the 404 error logs?', function (ok) {
			if (ok) {
				socket.emit('admin.errors.clear', {}, function (err) {
					if (err) {
						return app.alertError(err.message);
					}

					ajaxify.refresh();
					app.alertSuccess('"404 Not Found" errors cleared');
				});
			}
		});
	};

	Errors.setupCharts = function () {
		var notFoundCanvas = document.getElementById('not-found'),
			tooBusyCanvas = document.getElementById('toobusy'),
			dailyLabels = utils.getDaysArray();

		dailyLabels = dailyLabels.slice(-7);

		if (utils.isMobile()) {
			Chart.defaults.global.tooltips.enabled = false;
		}

		var data = {
			'not-found': {
				labels: dailyLabels,
				datasets: [
					{
						label: "",
						backgroundColor: "rgba(186,139,175,0.2)",
						borderColor: "rgba(186,139,175,1)",
						pointBackgroundColor: "rgba(186,139,175,1)",
						pointHoverBackgroundColor: "#fff",
						pointBorderColor: "#fff",
						pointHoverBorderColor: "rgba(186,139,175,1)",
						data: ajaxify.data.analytics['not-found']
					}
				]
			},
			'toobusy': {
				labels: dailyLabels,
				datasets: [
					{
						label: "",
						backgroundColor: "rgba(151,187,205,0.2)",
						borderColor: "rgba(151,187,205,1)",
						pointBackgroundColor: "rgba(151,187,205,1)",
						pointHoverBackgroundColor: "#fff",
						pointBorderColor: "#fff",
						pointHoverBorderColor: "rgba(151,187,205,1)",
						data: ajaxify.data.analytics['toobusy']
					}
				]
			}
		};

		notFoundCanvas.width = $(notFoundCanvas).parent().width();
		tooBusyCanvas.width = $(tooBusyCanvas).parent().width();
		
		new Chart(notFoundCanvas.getContext('2d'), {
			type: 'line',
			data: data['not-found'],
			options: {
				responsive: true,
				legend: {
					display: false
				},
				scales: {
					yAxes: [{
						ticks: {
							beginAtZero: true
						}
					}]
				}
			}
		});
		
		new Chart(tooBusyCanvas.getContext('2d'), {
			type: 'line',
			data: data['toobusy'],
			options: {
				responsive: true,
				legend: {
					display: false
				},
				scales: {
					yAxes: [{
						ticks: {
							beginAtZero: true
						}
					}]
				}
			}
		});
	};

	return Errors;
});