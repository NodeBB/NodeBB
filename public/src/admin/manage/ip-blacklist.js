'use strict';


define('admin/manage/ip-blacklist', ['Chart', 'benchpress'], function (Chart, Benchpress) {
	var Blacklist = {};

	Blacklist.init = function () {
		var blacklist = $('#blacklist-rules');

		blacklist.on('keyup', function () {
			$('#blacklist-rules-holder').val(blacklist.val());
		});

		$('[data-action="apply"]').on('click', function () {
			socket.emit('blacklist.save', blacklist.val(), function (err) {
				if (err) {
					return app.alertError(err.message);
				}
				app.alert({
					type: 'success',
					alert_id: 'blacklist-saved',
					title: '[[admin/manage/ip-blacklist:alerts.applied-success]]',
				});
			});
		});

		$('[data-action="test"]').on('click', function () {
			socket.emit('blacklist.validate', {
				rules: blacklist.val(),
			}, function (err, data) {
				if (err) {
					return app.alertError(err.message);
				}

				Benchpress.parse('admin/partials/blacklist-validate', data, function (html) {
					bootbox.alert(html);
				});
			});
		});

		Blacklist.setupAnalytics();
	};

	Blacklist.setupAnalytics = function () {
		var hourlyCanvas = document.getElementById('blacklist:hourly');
		var	dailyCanvas = document.getElementById('blacklist:daily');
		var	hourlyLabels = utils.getHoursArray().map(function (text, idx) {
			return idx % 3 ? '' : text;
		});
		var	dailyLabels = utils.getDaysArray().slice(-7).map(function (text, idx) {
			return idx % 3 ? '' : text;
		});

		if (utils.isMobile()) {
			Chart.defaults.global.tooltips.enabled = false;
		}

		var data = {
			'blacklist:hourly': {
				labels: hourlyLabels,
				datasets: [
					{
						label: '',
						backgroundColor: 'rgba(186,139,175,0.2)',
						borderColor: 'rgba(186,139,175,1)',
						pointBackgroundColor: 'rgba(186,139,175,1)',
						pointHoverBackgroundColor: '#fff',
						pointBorderColor: '#fff',
						pointHoverBorderColor: 'rgba(186,139,175,1)',
						data: ajaxify.data.analytics.hourly,
					},
				],
			},
			'blacklist:daily': {
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
						data: ajaxify.data.analytics.daily,
					},
				],
			},
		};

		hourlyCanvas.width = $(hourlyCanvas).parent().width();
		dailyCanvas.width = $(dailyCanvas).parent().width();

		new Chart(hourlyCanvas.getContext('2d'), {
			type: 'line',
			data: data['blacklist:hourly'],
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

		new Chart(dailyCanvas.getContext('2d'), {
			type: 'line',
			data: data['blacklist:daily'],
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

	return Blacklist;
});
