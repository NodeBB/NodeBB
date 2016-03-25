"use strict";
/*global config, define, app, socket, ajaxify, bootbox, templates, Chart, utils */

define('admin/manage/category-analytics', [], function() {
	var CategoryAnalytics = {};

	CategoryAnalytics.init = function() {
		var hourlyCanvas = document.getElementById('pageviews:hourly'),
			dailyCanvas = document.getElementById('pageviews:daily'),
			topicsCanvas = document.getElementById('topics:daily'),
			postsCanvas = document.getElementById('posts:daily'),
			hourlyLabels = utils.getHoursArray().map(function(text, idx) {
				return idx % 3 ? '' : text;
			}),
			dailyLabels = utils.getDaysArray().map(function(text, idx) {
				return idx % 3 ? '' : text;
			});

		if (utils.isMobile()) {
			Chart.defaults.global.showTooltips = false;
		}

		var data = {
			'pageviews:hourly': {
				labels: hourlyLabels,
				datasets: [
					{
						label: "",
						fillColor: "rgba(186,139,175,0.2)",
						strokeColor: "rgba(186,139,175,1)",
						pointColor: "rgba(186,139,175,1)",
						pointStrokeColor: "#fff",
						pointHighlightFill: "#fff",
						pointHighlightStroke: "rgba(186,139,175,1)",
						data: ajaxify.data.analytics['pageviews:hourly']
					}
				]
			},
			'pageviews:daily': {
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
						data: ajaxify.data.analytics['pageviews:daily']
					}
				]
			},
			'topics:daily': {
				labels: dailyLabels.slice(-7),
				datasets: [
					{
						label: "",
						fillColor: "rgba(171,70,66,0.2)",
						strokeColor: "rgba(171,70,66,1)",
						pointColor: "rgba(171,70,66,1)",
						pointStrokeColor: "#fff",
						pointHighlightFill: "#fff",
						pointHighlightStroke: "rgba(171,70,66,1)",
						data: ajaxify.data.analytics['topics:daily']
					}
				]
			},
			'posts:daily': {
				labels: dailyLabels.slice(-7),
				datasets: [
					{
						label: "",
						fillColor: "rgba(161,181,108,0.2)",
						strokeColor: "rgba(161,181,108,1)",
						pointColor: "rgba(161,181,108,1)",
						pointStrokeColor: "#fff",
						pointHighlightFill: "#fff",
						pointHighlightStroke: "rgba(161,181,108,1)",
						data: ajaxify.data.analytics['posts:daily']
					}
				]
			},
		};

		hourlyCanvas.width = $(hourlyCanvas).parent().width();
		dailyCanvas.width = $(dailyCanvas).parent().width();
		topicsCanvas.width = $(topicsCanvas).parent().width();
		postsCanvas.width = $(postsCanvas).parent().width();
		new Chart(hourlyCanvas.getContext('2d')).Line(data['pageviews:hourly'], {
			responsive: true,
			animation: false
		});
		new Chart(dailyCanvas.getContext('2d')).Line(data['pageviews:daily'], {
			responsive: true,
			animation: false
		});
		new Chart(topicsCanvas.getContext('2d')).Line(data['topics:daily'], {
			responsive: true,
			animation: false
		});
		new Chart(postsCanvas.getContext('2d')).Line(data['posts:daily'], {
			responsive: true,
			animation: false
		});
	};

	return CategoryAnalytics;
});