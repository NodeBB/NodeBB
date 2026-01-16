'use strict';

define('categoryFilter', ['categorySearch', 'api', 'hooks'], function (categorySearch, api, hooks) {
	const categoryFilter = {};

	categoryFilter.init = function (el, options) {
		if (!el || !el.length) {
			return;
		}
		options = options || {};
		options.states = options.states || ['watching', 'tracking', 'notwatching', 'ignoring'];
		options.template = options.template || 'partials/category/filter-dropdown-left';

		hooks.fire('action:category.filter.options', { el: el, options: options });

		categorySearch.init(el, options);

		let selectedCids = [];
		let initialCids = [];
		if (Array.isArray(options.selectedCids)) {
			selectedCids = options.selectedCids.map(String);
		} else if (Array.isArray(ajaxify.data.selectedCids)) {
			selectedCids = ajaxify.data.selectedCids.map(String);
		}
		initialCids = selectedCids.slice();

		el.on('hidden.bs.dropdown', function () {
			let changed = initialCids.length !== selectedCids.length;
			initialCids.forEach(function (cid, index) {
				if (cid !== selectedCids[index]) {
					changed = true;
				}
			});
			initialCids = selectedCids.slice();

			if (changed) {
				if (options.updateButton) {
					options.updateButton({ el, changed: changed, selectedCids: selectedCids.slice() });
				} else if (options.updateButton !== false) {
					updateFilterButton(el, selectedCids);
				}
			}
			if (options.onHidden) {
				options.onHidden({ changed: changed, selectedCids: selectedCids.slice() });
				return;
			}
			if (changed) {
				let url = window.location.pathname;
				const currentParams = utils.params();
				if (selectedCids.length) {
					currentParams.cid = selectedCids;
				} else {
					delete currentParams.cid;
				}

				delete currentParams.page;
				if (Object.keys(currentParams).length) {
					url += '?' + $.param(currentParams);
				}
				ajaxify.go(url);
			}
		});

		el.on('click', '[component="category/list"] [data-cid]', function (ev) {
			const listEl = el.find('[component="category/list"]');
			const categoryEl = $(this);
			const link = categoryEl.find('a').attr('href');
			if (link && link !== '#' && link.length) {
				ev.stopPropagation();
				return;
			}
			const cid = categoryEl.attr('data-cid');
			const icon = categoryEl.find('[component="category/select/icon"]');

			if (cid !== 'all') {
				if (selectedCids.includes(cid)) {
					selectedCids.splice(selectedCids.indexOf(cid), 1);
				} else {
					selectedCids.push(cid);
				}
				selectedCids.sort(function (a, b) {
					return a - b;
				});
				icon.toggleClass('invisible');
				listEl.find('[data-cid="all"] i').toggleClass('invisible', !!selectedCids.length);
			} else {
				el.find('[component="category/select/icon"]').addClass('invisible');
				listEl.find('[data-cid="all"] i').removeClass('invisible');
				selectedCids = [];
			}

			options.selectedCids = selectedCids;

			if (options.onSelect) {
				options.onSelect({ cid: cid, selectedCids: selectedCids.slice() });
			}
			return false;
		});
	};

	function updateFilterButton(el, selectedCids) {
		if (selectedCids.length > 1) {
			renderButton({
				icon: 'fa-plus',
				name: '[[unread:multiple-categories-selected]]',
				bgColor: '#ddd',
			});
		} else if (selectedCids.length === 1) {
			api.get(`/categories/${selectedCids[0]}`, {}).then(renderButton);
		} else {
			renderButton();
		}
		function renderButton(category) {
			app.parseAndTranslate('partials/category/filter-dropdown-content', {
				selectedCategory: category,
			}, function (html) {
				el.find('button').replaceWith($('<div/>').html(html).find('button'));
			});
		}
	}

	return categoryFilter;
});
