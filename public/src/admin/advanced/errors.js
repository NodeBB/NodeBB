"use strict";
/*global config, define, app, socket, ajaxify, bootbox, templates, Chart, utils */

define('admin/advanced/errors', ['Chart'], function(Chart) {
	var Errors = {};

	Errors.init = function() {
		var notFoundCanvas = document.getElementById('not-found'),
			tooBusyCanvas = document.getElementById('toobusy'),
			dailyLabels = utils.getDaysArray();

		dailyLabels.length = 7;

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