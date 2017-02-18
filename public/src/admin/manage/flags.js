'use strict';


define('admin/manage/flags', [
	'autocomplete',
	'Chart',
	'components',
	'translator',
], function (autocomplete, Chart, components, translator) {
	var	Flags = {};

	Flags.init = function () {
		$('.post-container .content img:not(.not-responsive)').addClass('img-responsive');

		autocomplete.user($('#byUsername'));

		handleDismiss();
		handleDismissAll();
		handleDelete();
		handleGraphs();

		updateFlagDetails(ajaxify.data.posts);

		components.get('posts/flags').on('click', '[component="posts/flag/update"]', updateFlag);

		// Open flag as indicated in location bar
		if (window.location.hash.startsWith('#flag-pid-')) {
			$(window.location.hash).collapse('toggle');
		}
	};

	function handleDismiss() {
		$('.flags').on('click', '.dismiss', function () {
			var btn = $(this);
			var pid = btn.parents('[data-pid]').attr('data-pid');

			socket.emit('posts.dismissFlag', pid, function (err) {
				done(err, btn);
			});
 		});
	}

	function handleDismissAll() {
		$('#dismissAll').on('click', function () {
			socket.emit('posts.dismissAllFlags', function (err) {
				if (err) {
					return app.alertError(err.message);
				}

				ajaxify.refresh();
			});
			return false;
		});
	}

	function handleDelete() {
		$('.flags').on('click', '.delete', function () {
			var btn = $(this);
			bootbox.confirm('[[admin/manage/flags:alerts.confirm-delete-post]]', function (confirm) {
				if (!confirm) {
					return;
				}
				var pid = btn.parents('[data-pid]').attr('data-pid');
				var tid = btn.parents('[data-pid]').attr('data-tid');
				socket.emit('posts.delete', { pid: pid, tid: tid }, function (err) {
					done(err, btn);
				});
			});
		});
	}

	function done(err, btn) {
		if (err) {
			return app.alertError(err.messaage);
		}
		btn.parents('[data-pid]').fadeOut(function () {
			$(this).remove();
			if (!$('.flags [data-pid]').length) {
				translator.translate('[[admin/manage/flags:none-flagged]]', function (text) {
					$('.post-container').text(text);
				});
			}
		});
	}

	function handleGraphs() {
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
	}

	function updateFlagDetails(source) {
		// As the flag details are returned in the API,
		// update the form controls to show the correct data

		// Create reference hash for use in this method
		source = source.reduce(function (memo, cur) {
			memo[cur.pid] = cur.flagData;
			return memo;
		}, {});

		components.get('posts/flag').each(function (idx, el) {
			var pid = el.getAttribute('data-pid');
			el = $(el);

			if (source[pid]) {
				for (var prop in source[pid]) {
					if (source[pid].hasOwnProperty(prop)) {
						el.find('[name="' + prop + '"]').val(source[pid][prop]);
					}
				}
			}
		});
	}

	function updateFlag() {
		var pid = $(this).parents('[component="posts/flag"]').attr('data-pid');
		var formData = $($(this).parents('form').get(0)).serializeArray();

		socket.emit('posts.updateFlag', {
			pid: pid,
			data: formData,
		}, function (err) {
			if (err) {
				return app.alertError(err.message);
			}
			app.alertSuccess('[[topic:flag_manage_saved]]');
		});
	}

	return Flags;
});
