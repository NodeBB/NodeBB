'use strict';

define('categoryFilter', ['categorySearch'], function (categorySearch) {
	var categoryFilter = {};

	categoryFilter.init = function (el) {
		categorySearch.init(el);
		var listEl = el.find('[component="category/list"]');

		el.on('hidden.bs.dropdown', function () {
			var cids = getSelectedCids(el);
			var changed = ajaxify.data.selectedCids.length !== cids.length;
			ajaxify.data.selectedCids.forEach(function (cid, index) {
				if (cid !== cids[index]) {
					changed = true;
				}
			});

			if (changed) {
				var url = window.location.pathname;
				var currentParams = utils.params();
				if (cids.length) {
					currentParams.cid = cids;
					url += '?' + decodeURIComponent($.param(currentParams));
				}
				ajaxify.go(url);
			}
		});

		listEl.on('click', '[data-cid]', function (ev) {
			function selectChildren(parentCid, flag) {
				listEl.find('[data-parent-cid="' + parentCid + '"] [component="category/select/icon"]').toggleClass('invisible', flag);
				listEl.find('[data-parent-cid="' + parentCid + '"]').each(function (index, el) {
					selectChildren($(el).attr('data-cid'), flag);
				});
			}
			var categoryEl = $(this);
			var link = categoryEl.find('a').attr('href');
			if (link && link !== '#' && link.length) {
				return;
			}
			var cid = categoryEl.attr('data-cid');
			if (ev.ctrlKey) {
				selectChildren(cid, !categoryEl.find('[component="category/select/icon"]').hasClass('invisible'));
			}
			categoryEl.find('[component="category/select/icon"]').toggleClass('invisible');
			listEl.find('li').first().find('i').toggleClass('invisible', !!getSelectedCids(el).length);
			return false;
		});
	};

	function getSelectedCids(el) {
		var cids = [];
		el.find('[component="category/list"] [data-cid]').each(function (index, el) {
			if (!$(el).find('[component="category/select/icon"]').hasClass('invisible')) {
				cids.push(parseInt($(el).attr('data-cid'), 10));
			}
		});
		cids.sort(function (a, b) {
			return a - b;
		});
		return cids;
	}

	return categoryFilter;
});
