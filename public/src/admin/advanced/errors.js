"use strict";
/*global config, define, app, socket, ajaxify, bootbox, templates, Chart, utils */

define('admin/advanced/errors', ['Chart'], function(Chart) {
	var Errors = {};

	Errors.init = function() {
		Errors.setupCharts();

		$('[data-action="clear"]').on('click', Errors.clear404);
	};

	Errors.clear404 = function() {
		bootbox.confirm('Are you sure you wish to clear the 404 error logs?', function(ok) {
			if (ok) {
				socket.emit('admin.errors.clear', {}, function(err) {
					ajaxify.refresh();
					app.alertSuccess('"404 Not Found" errors cleared');
				});
			}
		});
	};

	Errors.setupCharts = function() {
		var notFoundCanvas = document.getElementById('not-found'),
			tooBusyCanvas = document.getElementById('toobusy'),
			dailyLabels = utils.getDaysArray();

		dailyLabels = dailyLabels.slice(-7);

		if (utils.isMobile()) {
			Chart.defaults.global.showTooltips = false;
		}

		var data = {
			'not-found': {
				labels: dailyLabels,
				datasets: [
					{
						label: "",
						fillColor: "rgba(186,139,175,0.2)",
						strokeColor: "rgba(186,139,175,1)",
						pointColor: "rgba(186,139,175,1)",
						pointStrokeColor: "#fff",
						pointHighlightFill: "#fff",
						pointHighlightStroke: "rgba(186,139,175,1)",
						data: ajaxify.data.analytics['not-found']
					}
				]
			},
			'toobusy': {
				labels: dailyLabels,
				datasets: [
					{
						label: "",
						fillColor: "rgba(151,187,205,0.2)",
						strokeColor: "rgba(151,187,205,1)",
						pointColor: "rgba(151,187,205,1)",
						pointStrokeColor: "#fff",
						pointHighlightFill: "#fff",
						pointHighlightStroke: "rgba(151,187,205,1)",
						data: ajaxify.data.analytics['toobusy']
					}
				]
			}
		};

		notFoundCanvas.width = $(notFoundCanvas).parent().width();
		tooBusyCanvas.width = $(tooBusyCanvas).parent().width();
		new Chart(notFoundCanvas.getContext('2d')).Line(data['not-found'], {
			responsive: true,
			animation: false
		});
		new Chart(tooBusyCanvas.getContext('2d')).Line(data['toobusy'], {
			responsive: true,
			animation: false
		});
	};

	return Errors;
});