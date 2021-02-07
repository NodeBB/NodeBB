'use strict';

define('categoryFilter', ['categorySearch'], function (categorySearch) {
	var categoryFilter = {};

	categoryFilter.init = function (el, options) {
		if (!el || !el.length) {
			return;
		}
		options = options || {};
		options.states = options.states || ['watching', 'notwatching', 'ignoring'];
		options.template = 'partials/category-filter';
		$(window).trigger('action:category.filter.options', { el: el, options: options });

		categorySearch.init(el, options);

		var selectedCids = [];
		var initialCids = [];
		if (Array.isArray(options.selectedCids)) {
			selectedCids = options.selectedCids.map(cid => parseInt(cid, 10));
		} else if (Array.isArray(ajaxify.data.selectedCids)) {
			selectedCids = ajaxify.data.selectedCids.map(cid => parseInt(cid, 10));
		}
		initialCids = selectedCids.slice();

		el.on('hidden.bs.dropdown', function () {
			var changed = initialCids.length !== selectedCids.length;
			initialCids.forEach(function (cid, index) {
				if (cid !== selectedCids[index]) {
					changed = true;
				}
			});
			if (options.onHidden) {
				options.onHidden({ changed: changed, selectedCids: selectedCids.slice() });
				return;
			}
			if (changed) {
				var url = window.location.pathname;
				var currentParams = utils.params();
				if (selectedCids.length) {
					currentParams.cid = selectedCids;
					url += '?' + decodeURIComponent($.param(currentParams));
				}
				ajaxify.go(url);
			}
		});

		el.on('click', '[component="category/list"] [data-cid]', function () {
			var listEl = el.find('[component="category/list"]');
			var categoryEl = $(this);
			var link = categoryEl.find('a').attr('href');
			if (link && link !== '#' && link.length) {
				return;
			}
			var cid = parseInt(categoryEl.attr('data-cid'), 10);
			var icon = categoryEl.find('[component="category/select/icon"]');

			if (selectedCids.includes(cid)) {
				selectedCids.splice(selectedCids.indexOf(cid), 1);
			} else {
				selectedCids.push(cid);
			}
			selectedCids.sort(function (a, b) {
				return a - b;
			});

			icon.toggleClass('invisible');
			listEl.find('li[data-all="all"] i').toggleClass('invisible', !!selectedCids.length);
			if (options.onSelect) {
				options.onSelect({ cid: cid, selectedCids: selectedCids.slice() });
			}
			return false;
		});
	};

	return categoryFilter;
});
