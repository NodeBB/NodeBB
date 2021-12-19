'use strict';

define('forum/flags/list', [
	'components', 'Chart', 'categoryFilter', 'autocomplete', 'api', 'alerts',
], function (components, Chart, categoryFilter, autocomplete, api, alerts) {
	const Flags = {};

	let selectedCids;

	Flags.init = function () {
		Flags.enableFilterForm();
		Flags.enableCheckboxes();
		Flags.handleBulkActions();

		selectedCids = [];
		if (ajaxify.data.filters.hasOwnProperty('cid')) {
			selectedCids = Array.isArray(ajaxify.data.filters.cid) ?
				ajaxify.data.filters.cid : [ajaxify.data.filters.cid];
		}

		categoryFilter.init($('[component="category/dropdown"]'), {
			privilege: 'moderate',
			selectedCids: selectedCids,
			onHidden: function (data) {
				selectedCids = data.selectedCids;
			},
		});

		components.get('flags/list')
			.on('click', '[data-flag-id]', function (e) {
				if (['BUTTON', 'A'].includes(e.target.nodeName)) {
					return;
				}

				const flagId = this.getAttribute('data-flag-id');
				ajaxify.go('flags/' + flagId);
			});

		$('#flags-daily-wrapper').one('shown.bs.collapse', function () {
			Flags.handleGraphs();
		});

		autocomplete.user($('#filter-assignee, #filter-targetUid, #filter-reporterId'), (ev, ui) => {
			setTimeout(() => { ev.target.value = ui.item.user.uid; });
		});
	};

	Flags.enableFilterForm = function () {
		const $filtersEl = components.get('flags/filters');

		// Parse ajaxify data to set form values to reflect current filters
		for (const filter in ajaxify.data.filters) {
			if (ajaxify.data.filters.hasOwnProperty(filter)) {
				$filtersEl.find('[name="' + filter + '"]').val(ajaxify.data.filters[filter]);
			}
		}
		$filtersEl.find('[name="sort"]').val(ajaxify.data.sort);

		document.getElementById('apply-filters').addEventListener('click', function () {
			const payload = $filtersEl.serializeArray();
			// cid is special comes from categoryFilter module
			selectedCids.forEach(function (cid) {
				payload.push({ name: 'cid', value: cid });
			});

			ajaxify.go('flags?' + (payload.length ? $.param(payload) : 'reset=1'));
		});

		$filtersEl.find('button[data-target="#more-filters"]').click((ev) => {
			const textVariant = ev.target.getAttribute('data-text-variant');
			if (!textVariant) {
				return;
			}
			ev.target.setAttribute('data-text-variant', ev.target.textContent);
			ev.target.firstChild.textContent = textVariant;
		});
	};

	Flags.enableCheckboxes = function () {
		const flagsList = document.querySelector('[component="flags/list"]');
		const checkboxes = flagsList.querySelectorAll('[data-flag-id] input[type="checkbox"]');
		const bulkEl = document.querySelector('[component="flags/bulk-actions"] button');
		let lastClicked;

		document.querySelector('[data-action="toggle-all"]').addEventListener('click', function () {
			const state = this.checked;

			checkboxes.forEach(function (el) {
				el.checked = state;
			});
			bulkEl.disabled = !state;
		});

		flagsList.addEventListener('click', function (e) {
			const subselector = e.target.closest('input[type="checkbox"]');
			if (subselector) {
				// Stop checkbox clicks from going into the flag details
				e.stopImmediatePropagation();

				if (lastClicked && e.shiftKey && lastClicked !== subselector) {
					// Select all the checkboxes in between
					const state = subselector.checked;
					let started = false;

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
			const subselector = e.target.closest('[data-action]');
			if (subselector) {
				const action = subselector.getAttribute('data-action');
				const flagIds = Flags.getSelected();
				const promises = flagIds.map((flagId) => {
					const data = {};
					if (action === 'bulk-assign') {
						data.assignee = app.user.uid;
					} else if (action === 'bulk-mark-resolved') {
						data.state = 'resolved';
					}
					return api.put(`/flags/${flagId}`, data);
				});

				Promise.allSettled(promises).then(function (results) {
					const fulfilled = results.filter(function (res) {
						return res.status === 'fulfilled';
					}).length;
					const errors = results.filter(function (res) {
						return res.status === 'rejected';
					});
					if (fulfilled) {
						alerts.success('[[flags:bulk-success, ' + fulfilled + ']]');
						ajaxify.refresh();
					}

					errors.forEach(function (res) {
						alerts.error(res.reason);
					});
				});
			}
		});
	};

	Flags.getSelected = function () {
		const checkboxes = document.querySelectorAll('[component="flags/list"] [data-flag-id] input[type="checkbox"]');
		const payload = [];
		checkboxes.forEach(function (el) {
			if (el.checked) {
				payload.push(el.closest('[data-flag-id]').getAttribute('data-flag-id'));
			}
		});

		return payload;
	};

	Flags.handleGraphs = function () {
		const dailyCanvas = document.getElementById('flags:daily');
		const dailyLabels = utils.getDaysArray().map(function (text, idx) {
			return idx % 3 ? '' : text;
		});

		if (utils.isMobile()) {
			Chart.defaults.global.tooltips.enabled = false;
		}
		const data = {
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
