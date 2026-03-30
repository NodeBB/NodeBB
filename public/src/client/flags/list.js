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

import * as categoryFilter from '../../modules/categoryFilter';
import * as userFilter from '../../modules/userFilter';
import * as autocomplete from '../../modules/autocomplete';
import * as api from '../../modules/api';
import * as alerts from '../../modules/alerts';
import * as components from '../../modules/components';

Chart.register(LineController, CategoryScale, LinearScale, LineElement, PointElement, Tooltip, Filler);

const selected = new Map([
	['cids', []],
	['assignee', []],
	['targetUid', []],
	['reporterId', []],
]);

export function init() {
	enableFilterForm();
	enableCheckboxes();
	handleBulkActions();

	if (ajaxify.data.filters.hasOwnProperty('cid')) {
		selected.set('cids', Array.isArray(ajaxify.data.filters.cid) ?
			ajaxify.data.filters.cid : [ajaxify.data.filters.cid]);
	}

	categoryFilter.init($('[component="category/dropdown"]'), {
		privilege: 'moderate',
		selectedCids: selected.get('cids'),
		updateButton: function ({ selectedCids: cids }) {
			selected.set('cids', cids);
			applyFilters();
		},
	});

	['assignee', 'targetUid', 'reporterId'].forEach((filter) => {
		if (ajaxify.data.filters.hasOwnProperty('filter')) {
			selected.set(filter, ajaxify.data.selected[filter]);
		}
		const filterEl = $(`[component="flags/filter/${filter}"]`);
		userFilter.init(filterEl, {
			selectedUsers: selected.get(filter),
			template: 'partials/flags/filters',
			selectedBlock: `selected.${filter}`,
			onSelect: function (_selectedUsers) {
				selected.set(filter, _selectedUsers);
			},
			onHidden: function () {
				applyFilters();
			},
		});
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
		handleGraphs();
	});

	autocomplete.user($('#filter-assignee, #filter-targetUid, #filter-reporterId'), (ev, ui) => {
		setTimeout(() => { ev.target.value = ui.item.user.uid; });
	});
}

export function enableFilterForm() {
	const $filtersEl = components.get('flags/filters');
	if ($filtersEl && $filtersEl.get(0).nodeName !== 'FORM') {
		// Harmony; update hidden form and submit on change
		const filtersEl = $filtersEl.get(0);
		const formEl = filtersEl.querySelector('form');

		filtersEl.addEventListener('click', (e) => {
			const subselector = e.target.closest('[data-value]');
			if (!subselector) {
				return;
			}

			const name = subselector.getAttribute('data-name');
			const value = subselector.getAttribute('data-value');

			formEl[name].value = value;

			applyFilters();
		});
	} else {
		// Persona; parse ajaxify data to set form values to reflect current filters
		for (const [filter, value] of Object.entries(ajaxify.data.filters)) {
			$filtersEl.find('[name="' + filter + '"]').val(value);
		}
		$filtersEl.find('[name="sort"]').val(ajaxify.data.sort);

		document.getElementById('apply-filters').addEventListener('click', function () {
			applyFilters();
		});

		$filtersEl.find('button[data-target="#more-filters"]').click((ev) => {
			const textVariant = ev.target.getAttribute('data-text-variant');
			if (!textVariant) {
				return;
			}
			ev.target.setAttribute('data-text-variant', ev.target.textContent);
			ev.target.firstChild.textContent = textVariant;
		});
	}
}

function applyFilters() {
	let formEl = components.get('flags/filters').get(0);
	if (!formEl) {
		return;
	}
	if (formEl.nodeName !== 'FORM') {
		formEl = formEl.querySelector('form');
	}

	const payload = new FormData(formEl);

	// cid is special comes from categoryFilter module
	selected.get('cids').forEach(function (cid) {
		payload.append('cid', cid);
	});

	// these three fields are special; comes from userFilter module
	['assignee', 'targetUid', 'reporterId'].forEach((filter) => {
		selected.get(filter).forEach(({ uid }) => {
			payload.append(filter, uid);
		});
	});

	const length = Array.from(payload.values()).filter(Boolean);
	const qs = new URLSearchParams(payload).toString();

	ajaxify.go('flags?' + (length ? qs : 'reset=1'));
}

export function enableCheckboxes() {
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
}

export function handleBulkActions() {
	document.querySelector('[component="flags/bulk-actions"]').addEventListener('click', function (e) {
		const subselector = e.target.closest('[data-action]');
		if (subselector) {
			const action = subselector.getAttribute('data-action');
			let confirmed;
			if (action === 'bulk-purge') {
				confirmed = new Promise((resolve, reject) => {
					bootbox.confirm('[[flags:confirm-purge]]', (confirmed) => {
						if (confirmed) {
							resolve();
						} else {
							reject(new Error('[[flags:purge-cancelled]]'));
						}
					});
				});
			}
			const flagIds = getSelected();
			const promises = flagIds.map(async (flagId) => {
				const data = {};
				switch (action) {
					case 'bulk-assign': {
						data.assignee = app.user.uid;
						break;
					}
					case 'bulk-mark-resolved': {
						data.state = 'resolved';
						break;
					}
					case 'bulk-purge': {
						await confirmed;
						return api.del(`/flags/${flagId}`);
					}
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
}

export function getSelected() {
	const checkboxes = document.querySelectorAll('[component="flags/list"] [data-flag-id] input[type="checkbox"]');
	const payload = [];
	checkboxes.forEach(function (el) {
		if (el.checked) {
			payload.push(el.closest('[data-flag-id]').getAttribute('data-flag-id'));
		}
	});

	return payload;
}

export function handleGraphs() {
	const dailyCanvas = document.getElementById('flags:daily');
	const dailyLabels = utils.getDaysArray().map(function (text, idx) {
		return idx % 3 ? '' : text;
	});

	if (utils.isMobile()) {
		Chart.defaults.plugins.tooltip.enabled = false;
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
			scales: {
				y: {
					beginAtZero: true,
				},
			},
		},
	});
}

