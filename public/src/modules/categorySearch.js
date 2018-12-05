'use strict';

define('categorySearch', function () {
	var categorySearch = {};

	categorySearch.init = function (el) {
		if (utils.isTouchDevice()) {
			return;
		}
		var searchEl = el.find('[component="category-selector-search"]');
		if (!searchEl.length) {
			return;
		}
		var categoryEls = el.find('[component="category/list"] [data-cid]');
		el.on('show.bs.dropdown', function () {
			function updateList() {
				var val = searchEl.find('input').val().toLowerCase();
				var noMatch = true;
				categoryEls.each(function () {
					var liEl = $(this);
					var isMatch = liEl.attr('data-name').toLowerCase().indexOf(val) !== -1;
					if (noMatch && isMatch) {
						noMatch = false;
					}
					liEl.toggleClass('hidden', !isMatch);
				});

				el.find('[component="category/list"] [component="category/no-matches"]').toggleClass('hidden', !noMatch);
			}
			el.find('.dropdown-toggle').addClass('hidden');
			searchEl.removeClass('hidden').on('click', function (ev) {
				ev.preventDefault();
				ev.stopPropagation();
			});
			searchEl.find('input').val('').focus().on('keyup', updateList);
			updateList();
		});

		el.on('hide.bs.dropdown', function () {
			el.find('.dropdown-toggle').removeClass('hidden');
			searchEl.addClass('hidden').off('click');
			searchEl.find('input').off('keyup');
		});
	};

	return categorySearch;
});
