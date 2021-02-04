'use strict';

define('categoryFilter', ['categorySearch2'], function (categorySearch) {
	var categoryFilter = {};

	var selectedCids = [];

	categoryFilter.init = function (el) {
		categorySearch.init(el, {
			template: 'partials/category-filter',
		});

		selectedCids = ajaxify.data.selectedCids.slice();

		el.on('hidden.bs.dropdown', function () {
			var changed = ajaxify.data.selectedCids.length !== selectedCids.length;
			ajaxify.data.selectedCids.forEach(function (cid, index) {
				if (cid !== selectedCids[index]) {
					changed = true;
				}
			});

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
			listEl.find('li').first().find('i').toggleClass('invisible', !!selectedCids.length);
			return false;
		});
	};

	return categoryFilter;
});
