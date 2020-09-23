'use strict';

define('forum/flags/list', ['components', 'Chart'], function (components, Chart) {
	var Flags = {};

	Flags.init = function () {
		Flags.enableFilterForm();
		Flags.enableCheckboxes();
		Flags.handleBulkActions();

		components.get('flags/list')
			.on('click', '[data-flag-id]', function (e) {
				if (['BUTTON', 'A'].includes(e.target.nodeName)) {
					return;
				}

				var flagId = this.getAttribute('data-flag-id');
				ajaxify.go('flags/' + flagId);
			});

		var graphWrapper = $('#flags-daily-wrapper');
		var graphFooter = graphWrapper.siblings('.panel-footer');
		$('#flags-daily-wrapper').one('shown.bs.collapse', function () {
			Flags.handleGraphs();
		});
		graphFooter.on('click', graphWrapper.collapse.bind(graphWrapper, 'toggle'));
	};

	Flags.enableFilterForm = function () {
		var filtersEl = components.get('flags/filters');

		// Parse ajaxify data to set form values to reflect current filters
		for (var filter in ajaxify.data.filters) {
			if (ajaxify.data.filters.hasOwnProperty(filter)) {
				filtersEl.find('[name="' + filter + '"]').val(ajaxify.data.filters[filter]);
			}
		}
		filtersEl.find('[name="sort"]').val(ajaxify.data.sort);

		document.getElementById('apply-filters').addEventListener('click', function () {
			var payload = filtersEl.serializeArray();
			ajaxify.go('flags?' + (payload.length ? $.param(payload) : 'reset=1'));
		});
	};

	Flags.enableCheckboxes = function () {
		var flagsList = document.querySelector('[component="flags/list"]');
		var checkboxes = flagsList.querySelectorAll('[data-flag-id] input[type="checkbox"]');
		var bulkEl = document.querySelector('[component="flags/bulk-actions"] button');
		var lastClicked;

		document.querySelector('[data-action="toggle-all"]').addEventListener('click', function () {
			var state = this.checked;

			checkboxes.forEach(function (el) {
				el.checked = state;
			});
			bulkEl.disabled = !state;
		});

		flagsList.addEventListener('click', function (e) {
			var subselector = e.target.closest('input[type="checkbox"]');
			if (subselector) {
				// Stop checkbox clicks from going into the flag details
				e.stopImmediatePropagation();

				if (lastClicked && e.shiftKey && lastClicked !== subselector) {
					// Select all the checkboxes in between
					var state = subselector.checked;
					var started = false;

					checkboxes.forEach(function (el) {
						if ([subselector, lastClicked].some(function (ref) {
							return ref === el;
						})) {
							started = !started;
						}

						if (started) {
							el.checked = state;
						}
					});
				}

				// (De)activate bulk actions button based on checkboxes' state
				bulkEl.disabled = !Array.prototype.some.call(checkboxes, function (el) {
					return el.checked;
				});

				lastClicked = subselector;
			}

			// If you miss the checkbox, don't descend into the flag details, either
			if (e.target.querySelector('input[type="checkbox"]')) {
				e.stopImmediatePropagation();
			}
		});
	};

	Flags.handleBulkActions = function () {
		document.querySelector('[component="flags/bulk-actions"]').addEventListener('click', function (e) {
			var subselector = e.target.closest('[data-action]');
			if (subselector) {
				var action = subselector.getAttribute('data-action');
				var flagIds = Flags.getSelected();
				var promises = [];

				// TODO: this can be better done with flagIds.map to return promises
				flagIds.forEach(function (flagId) {
					promises.push(new Promise(function (resolve, reject) {
						var handler = function (err) {
							if (err) {
								reject(err);
							}

							resolve(arguments[1]);
						};

						switch (action) {
							case 'bulk-assign':
								socket.emit('flags.update', {
									flagId: flagId,
									data: [
										{
											name: 'assignee',
											value: app.user.uid,
										},
									],
								}, handler);
								break;

							case 'bulk-mark-resolved':
								socket.emit('flags.update', {
									flagId: flagId,
									data: [
										{
											name: 'state',
											value: 'resolved',
										},
									],
								}, handler);
								break;
						}
					}));
				});

				Promise.allSettled(promises).then(function (results) {
					var fulfilled = results.filter(function (res) {
						return res.status === 'fulfilled';
					}).length;
					var errors = results.filter(function (res) {
						return res.status === 'rejected';
					});
					if (fulfilled) {
						app.alertSuccess('[[flags:bulk-success, ' + fulfilled + ']]');
					}

					errors.forEach(function (res) {
						app.alertError(res.reason);
					});
				});
			}
		});
	};

	Flags.getSelected = function () {
		var checkboxes = document.querySelectorAll('[component="flags/list"] [data-flag-id] input[type="checkbox"]');
		var payload = [];
		checkboxes.forEach(function (el) {
			if (el.checked) {
				payload.push(el.closest('[data-flag-id]').getAttribute('data-flag-id'));
			}
		});

		return payload;
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
							precision: 0,
						},
					}],
				},
			},
		});
	};

	return Flags;
});
